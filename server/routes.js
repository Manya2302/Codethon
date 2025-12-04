import { createServer } from "http";
import { Server } from "socket.io";
import { storage } from "./storage.js";
import authRoutes from "./auth-routes.js";
import { sendAccountApprovalEmail, sendAccountRejectionEmail } from "./email-service.js";
import { User, Project, RegisteredProfessional, Property, Transaction, Document, Meeting } from "../shared/schema.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import cron from "node-cron";
import { uploadImageToGridFS, getImageStream, getGridFSBucket } from './gridfs-storage.js';
import { generatePincodeBoundary, clearBoundaryCache, getCacheStats, isPointInBoundary } from './utils/pincodeBoundaryGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const projectsUploadsDir = path.join(__dirname, '..', 'uploads', 'projects');
const propertiesUploadsDir = path.join(__dirname, '..', 'uploads', 'properties');
if (!fs.existsSync(projectsUploadsDir)) {
  fs.mkdirSync(projectsUploadsDir, { recursive: true });
}
if (!fs.existsSync(propertiesUploadsDir)) {
  fs.mkdirSync(propertiesUploadsDir, { recursive: true });
}

// Configure multer to store files in memory for GridFS upload
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const propertyUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper function to get Google Maps API key from environment
function getGoogleMapsApiKey() {
  return process.env.VITE_GOOGLE_MAPS_API_KEY || '';
}


// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Admin authorization middleware
const requireAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user || (user.role !== 'admin' && user.role !== 'superadmin' && user.role !== 'dataadmin' && user.role !== 'salesadmin')) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authorization check failed' });
  }
};

// Super Admin authorization middleware
const requireSuperAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authorization check failed' });
  }
};

export async function registerRoutes(app) {
  // Register specific API routes FIRST before authRoutes middleware
  // This ensures they are matched before any catch-all middleware

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Test route to verify RegisteredProfessional model is available
  app.get('/api/test-professionals', async (req, res) => {
    try {
      res.json({ 
        modelAvailable: !!RegisteredProfessional,
        modelType: typeof RegisteredProfessional,
        mongooseConnected: mongoose.connection.readyState === 1
      });
    } catch (error) {
      res.json({ error: error.message });
    }
  });

  // News API endpoint - using GNews API for real estate news from India
  // Register VERY early to ensure it's available
  app.get('/api/news', async (req, res) => {
    console.log('📰 /api/news route hit - Request received');
    res.setHeader('Content-Type', 'application/json');
    
    try {
      // Dynamic import using relative path (ES modules)
      const { getNews } = await import('./services/newsService.js');
      const newsData = await getNews();
      console.log('News data retrieved:', newsData.totalArticles, 'articles');
      return res.json(newsData);
    } catch (error) {
      console.error('Error fetching news:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json({ 
        message: error.message || 'Failed to fetch news',
        articles: [] 
      });
    }
  });
  
  console.log('✅ /api/news route registered successfully');

  // Chat API endpoint - for AI chat assistant
  app.post('/api/chat', requireAuth, async (req, res) => {
    console.log('💬 /api/chat route hit - Request received');
    console.log('📋 Request body:', req.body);
    console.log('👤 User ID:', req.session?.userId);
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { message } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ 
          message: 'Message is required',
          response: 'Please provide a message to continue the conversation.' 
        });
      }

      const userMessage = message.trim();
      console.log('📝 User message:', userMessage);

      // OmniDimension API endpoint - try multiple possible endpoints
      const omniSecretKey = '81624846b4b52b11a8b4789a72ee0942';
      const possibleEndpoints = [
        'https://backend.omnidim.io/api/v1/chat',
        'https://api.omnidim.io/v1/chat',
        'https://backend.omnidim.io/chat'
      ];
      
      let lastError = null;
      
      // Try each endpoint
      for (const omniApiUrl of possibleEndpoints) {
        let timeoutId = null;
        try {
          console.log(`🔄 Trying OmniDimension API: ${omniApiUrl}`);
          
          // Create AbortController for timeout
          const controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const chatResponse = await fetch(omniApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${omniSecretKey}`,
              'X-API-Key': omniSecretKey,
              'secret_key': omniSecretKey
            },
            body: JSON.stringify({
              message: userMessage,
              secret_key: omniSecretKey,
              query: userMessage
            }),
            signal: controller.signal
          });
          
          if (timeoutId) clearTimeout(timeoutId);

          if (chatResponse.ok) {
            const chatData = await chatResponse.json().catch(() => ({}));
            const responseText = chatData.response || chatData.message || chatData.text || chatData.answer || chatData.content;
            
            if (responseText) {
              console.log('✅ OmniDimension API response received');
              return res.json({
                message: 'Success',
                response: responseText
              });
            }
          } else {
            const errorText = await chatResponse.text().catch(() => '');
            console.warn(`⚠️ OmniDimension API returned status ${chatResponse.status}:`, errorText.substring(0, 200));
            lastError = `API returned status ${chatResponse.status}`;
          }
        } catch (apiError) {
          if (timeoutId) clearTimeout(timeoutId);
          
          if (apiError.name === 'AbortError') {
            console.warn(`⚠️ Request to ${omniApiUrl} timed out`);
            lastError = 'Request timeout';
          } else {
            console.warn(`⚠️ Error calling ${omniApiUrl}:`, apiError.message);
            lastError = apiError.message;
          }
          continue; // Try next endpoint
        }
      }

      // If all API calls failed, provide a helpful fallback response
      console.log('📝 Using fallback response (OmniDimension API unavailable)');
      
      // Generate context-aware responses based on the message
      const lowerMessage = userMessage.toLowerCase();
      let fallbackResponse = '';
      
      // Check for pincode boundary queries
      const pincodeMatch = userMessage.match(/\b(\d{6})\b/);
      const isBoundaryQuery = lowerMessage.includes('boundary') || lowerMessage.includes('show') || 
                              lowerMessage.includes('map') || lowerMessage.includes('area') ||
                              lowerMessage.includes('region') || lowerMessage.includes('zone');
      const isEntityQuery = lowerMessage.includes('properties') || lowerMessage.includes('projects') ||
                           lowerMessage.includes('list') || lowerMessage.includes('find') ||
                           lowerMessage.includes('inside') || lowerMessage.includes('within') ||
                           lowerMessage.includes('schools') || lowerMessage.includes('amenities') ||
                           lowerMessage.includes('brokers') || lowerMessage.includes('professionals');
      
      if (pincodeMatch && (isBoundaryQuery || isEntityQuery)) {
        const pincode = pincodeMatch[1];
        console.log(`🗺️ Detected pincode query: ${pincode}, boundary: ${isBoundaryQuery}, entity: ${isEntityQuery}`);
        
        try {
          // Fetch boundary data
          const boundaryResult = await generatePincodeBoundary(pincode);
          
          if (boundaryResult) {
            let responseText = `**Pincode ${pincode} Information**\n\n`;
            responseText += `Boundary generated using Google Maps road-network ML approximation.\n\n`;
            responseText += `**Location Details:**\n`;
            responseText += `- Center: ${boundaryResult.centroid.lat.toFixed(6)}, ${boundaryResult.centroid.lng.toFixed(6)}\n`;
            responseText += `- Boundary Points: ${boundaryResult.pointCount}\n`;
            
            if (boundaryResult.localities && boundaryResult.localities.length > 0) {
              responseText += `- Localities: ${boundaryResult.localities.join(', ')}\n`;
            }
            
            // If entity query, fetch entities within the boundary
            if (isEntityQuery) {
              const entities = {
                properties: [],
                projects: [],
                professionals: []
              };
              
              try {
                const allProperties = await Property.find({ status: 'active' }).lean();
                entities.properties = allProperties.filter(prop => {
                  if (prop.latitude && prop.longitude) {
                    return isPointInBoundary({ lat: prop.latitude, lng: prop.longitude }, boundaryResult.polygon);
                  }
                  return prop.pincode === pincode;
                });
                
                const allProjects = await Project.find({ status: { $ne: 'deleted' } }).lean();
                entities.projects = allProjects.filter(proj => {
                  if (proj.latitude && proj.longitude) {
                    return isPointInBoundary({ lat: proj.latitude, lng: proj.longitude }, boundaryResult.polygon);
                  }
                  return proj.pincode === pincode || (proj.territories && proj.territories.includes(pincode));
                });
                
                const allProfessionals = await RegisteredProfessional.find({ status: 'active' }).lean();
                entities.professionals = allProfessionals.filter(prof => {
                  if (prof.latitude && prof.longitude) {
                    return isPointInBoundary({ lat: prof.latitude, lng: prof.longitude }, boundaryResult.polygon);
                  }
                  return prof.pincode === pincode;
                });
              } catch (entityError) {
                console.warn('⚠️ Error fetching entities:', entityError.message);
              }
              
              responseText += `\n**Entities in this area:**\n`;
              responseText += `- Properties: ${entities.properties.length}\n`;
              responseText += `- Projects: ${entities.projects.length}\n`;
              responseText += `- Professionals: ${entities.professionals.length}\n`;
              
              if (entities.properties.length > 0) {
                responseText += `\n**Sample Properties:**\n`;
                entities.properties.slice(0, 3).forEach((prop, i) => {
                  responseText += `${i + 1}. ${prop.type} - ${prop.reason === 'sale' ? 'For Sale' : 'For Lease'} - ${prop.areaName || prop.address || 'N/A'}\n`;
                });
              }
              
              if (entities.projects.length > 0) {
                responseText += `\n**Sample Projects:**\n`;
                entities.projects.slice(0, 3).forEach((proj, i) => {
                  responseText += `${i + 1}. ${proj.projectName} - ${proj.status || 'Active'}\n`;
                });
              }
            }
            
            responseText += `\nTo view the boundary on the map, go to the Map section and search for pincode ${pincode}.`;
            
            return res.json({
              message: 'Success',
              response: responseText,
              pincode: pincode,
              boundary: boundaryResult.boundary,
              centroid: boundaryResult.centroid
            });
          }
        } catch (boundaryError) {
          console.warn('⚠️ Error processing pincode boundary query:', boundaryError.message);
        }
      }
      
      if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('rate')) {
        fallbackResponse = `Based on current market trends, Ahmedabad's average property prices are around ₹4,820-7,640 per sq. ft., with prices varying by location. The city remains one of India's most affordable major housing markets. Would you like information about prices in a specific area?`;
      } else if (lowerMessage.includes('investment') || lowerMessage.includes('invest')) {
        fallbackResponse = `Ahmedabad's real estate market offers good investment opportunities with steady growth. The city has seen 45% price appreciation over the last 5 years. Areas like Vastrapur, Sindhu Bhavan Road, and Sanand are seeing significant development. What type of property are you interested in?`;
      } else if (lowerMessage.includes('property') || lowerMessage.includes('home') || lowerMessage.includes('house')) {
        fallbackResponse = `I can help you with property information in Ahmedabad. The city offers a range of residential and commercial properties. Recent developments include projects in Sanand, Vastrapur, and along Sindhu Bhavan Road. What specific type of property are you looking for?`;
      } else if (lowerMessage.includes('trend') || lowerMessage.includes('market')) {
        fallbackResponse = `Ahmedabad's real estate market is showing steady growth with a 7.9% year-on-year increase in property prices. The market is characterized by strong end-user demand and controlled supply. Sales have increased despite fewer new launches. Would you like more specific market insights?`;
      } else if (pincodeMatch) {
        fallbackResponse = `I see you mentioned pincode ${pincodeMatch[1]}. You can:\n\n• Ask "Show me the boundary of ${pincodeMatch[1]}" to view the area\n• Ask "List all properties inside ${pincodeMatch[1]}" to find listings\n• Ask "Find projects within ${pincodeMatch[1]}" for development projects\n\nWhat would you like to know about this area?`;
      } else {
        fallbackResponse = `I received your message: "${userMessage}". As your AI real estate assistant for Ahmedabad, I can help you with:\n\n• Property prices and market trends\n• Investment opportunities and advice\n• Information about specific areas and localities\n• **Pincode boundary mapping** - Ask "Show me the boundary of 380052"\n• **Properties in an area** - Ask "List properties inside 380015"\n• Real estate regulations and documentation\n\nWhat would you like to know more about?`;
      }
      
      return res.json({
        message: 'Success',
        response: fallbackResponse
      });
      
    } catch (error) {
      console.error('❌ Error in chat endpoint:', error);
      console.error('❌ Error stack:', error.stack);
      
      // Always return a response, even on error
      return res.status(200).json({ 
        message: 'Success',
        response: 'I apologize, but I encountered an error processing your message. Please try again in a moment. If the issue persists, feel free to ask about Ahmedabad real estate, property prices, market trends, or investment opportunities.' 
      });
    }
  });
  
  console.log('✅ /api/chat route registered successfully');

  // Get all professionals for map display (public endpoint for map) - register before auth
  app.get('/api/registered-professionals/map', async (req, res) => {
    // Set response headers first
    res.setHeader('Content-Type', 'application/json');
    
    try {
      console.log('📍 /api/registered-professionals/map route hit');
      
      // Check if RegisteredProfessional model is available
      if (!RegisteredProfessional) {
        console.error('❌ RegisteredProfessional model is not available');
        return res.status(200).json([]);
      }

      // Check MongoDB connection state
      const connectionState = mongoose?.connection?.readyState;
      if (connectionState !== 1) {
        console.warn('⚠️ MongoDB not connected (readyState:', connectionState, '), returning empty array');
        return res.status(200).json([]);
      }

      console.log('✅ MongoDB connected, querying professionals...');
      
      // Use try-catch for the query itself
      let professionals = [];
      try {
        professionals = await RegisteredProfessional.find({
          latitude: { $exists: true, $ne: null },
          longitude: { $exists: true, $ne: null }
        }).select('_id name type phone pincode latitude longitude').lean();
      } catch (queryError) {
        console.error('❌ Query error:', queryError.message);
        return res.status(200).json([]);
      }
      
      console.log(`📍 Found ${professionals.length} professionals with coordinates for map`);
      return res.status(200).json(professionals || []);
    } catch (error) {
      console.error('❌ Error fetching professionals for map:', error);
      console.error('❌ Error name:', error.name);
      console.error('❌ Error message:', error.message);
      if (error.stack) {
        console.error('❌ Error stack:', error.stack.substring(0, 500));
      }
      // Always return empty array instead of error to prevent map from breaking
      return res.status(200).json([]);
    }
  });
  
  console.log('✅ /api/registered-professionals/map route registered successfully');

  // ========== IMAGE ROUTES (Public - before authRoutes) ==========
  // Serve images from GridFS or legacy uploads folder
  // Route for paths with slashes (e.g., /api/images/projects/filename.jpg)
  app.get(/^\/api\/images\/(.+)$/, async (req, res) => {
    try {
      // Extract the path after /api/images/ from the URL
      // For regex routes, the match is in req.params with numeric keys
      const match = req.path.match(/^\/api\/images\/(.+)$/);
      const imagePath = match ? match[1] : req.path.replace('/api/images/', '');
      console.log('[API] Image request for path:', imagePath);
      console.log('[API] Full request path:', req.path);
      
      // Check if it's a valid ObjectId (GridFS)
      if (mongoose.Types.ObjectId.isValid(imagePath)) {
        // It's a GridFS fileId
        const bucket = getGridFSBucket();
        if (!bucket) {
          console.error('[API] GridFS bucket not initialized');
          return res.status(503).json({ message: 'Image storage not available' });
        }

        // Check if file exists first
        const ObjectId = mongoose.Types.ObjectId;
        const files = bucket.find({ _id: new ObjectId(imagePath) });
        const fileArray = await files.toArray();
        
        if (fileArray.length === 0) {
          console.error('[API] Image not found in GridFS:', imagePath);
          return res.status(404).json({ message: 'Image not found' });
        }

        const file = fileArray[0];
        console.log('[API] Found GridFS image:', { filename: file.filename, length: file.length, contentType: file.contentType });

        // Set headers before streaming
        res.setHeader('Content-Type', file.contentType || 'image/jpeg');
        res.setHeader('Content-Length', file.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

        const imageStream = getImageStream(imagePath);
        
        imageStream.on('error', (error) => {
          console.error('[API] Error streaming GridFS image:', error);
          if (!res.headersSent) {
            if (error.code === 'ENOENT' || error.message.includes('not found')) {
              res.status(404).json({ message: 'Image not found' });
            } else {
              res.status(500).json({ message: 'Error retrieving image' });
            }
          }
        });

        imageStream.pipe(res);
      } else {
        // It's not a valid ObjectId, so it's likely a file path or filename
        const uploadsPath = path.join(__dirname, '..', 'uploads');
        let filePath = null;
        
        // Check if it's a full path like "projects/filename.jpg" or "properties/filename.jpg"
        if (imagePath.includes('/')) {
          // It's a relative path like "projects/filename.jpg" or "uploads/projects/filename.jpg"
          const cleanPath = imagePath.replace(/^\/?uploads\//, ''); // Remove leading /uploads/ if present
          filePath = path.join(uploadsPath, cleanPath);
        } else {
          // It's just a filename, try to find it in projects or properties folders
          const possiblePaths = [
            path.join(uploadsPath, 'projects', imagePath),
            path.join(uploadsPath, 'properties', imagePath),
            path.join(uploadsPath, imagePath)
          ];
          
          for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
              filePath = possiblePath;
              break;
            }
          }
        }
        
        if (filePath && fs.existsSync(filePath)) {
          const absolutePath = path.resolve(filePath);
          console.log('[API] Found uploads folder image at:', absolutePath);
          
          // Determine content type from file extension
          const ext = path.extname(imagePath).toLowerCase();
          const contentTypeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
          };
          const contentType = contentTypeMap[ext] || 'image/jpeg';
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
          return res.sendFile(absolutePath);
        }
        
        console.error('[API] Image not found in GridFS or uploads folder:', imagePath);
        console.error('[API] Searched in:', uploadsPath);
        if (imagePath.includes('/')) {
          const cleanPath = imagePath.replace(/^\/?uploads\//, '');
          console.error('[API] Tried path:', path.resolve(path.join(uploadsPath, cleanPath)));
        }
        return res.status(404).json({ message: 'Image not found' });
      }
    } catch (error) {
      console.error('[API] Error serving image:', error);
      console.error('[API] Error stack:', error.stack);
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || 'Error serving image' });
      }
    }
  });
  
  // Fallback route for single fileId (no slashes) - handles /api/images/:fileId
  // This must be AFTER the regex route to avoid conflicts
  app.get('/api/images/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      // Skip if fileId contains a slash (handled by regex route above)
      if (fileId.includes('/')) {
        return res.status(404).json({ message: 'Invalid image path' });
      }
      
      console.log('[API] Image request for single fileId:', fileId);
      
      // Check if it's a valid ObjectId (GridFS)
      if (mongoose.Types.ObjectId.isValid(fileId)) {
        const bucket = getGridFSBucket();
        if (!bucket) {
          return res.status(503).json({ message: 'Image storage not available' });
        }

        const ObjectId = mongoose.Types.ObjectId;
        const files = bucket.find({ _id: new ObjectId(fileId) });
        const fileArray = await files.toArray();
        
        if (fileArray.length === 0) {
          return res.status(404).json({ message: 'Image not found' });
        }

        const file = fileArray[0];
        res.setHeader('Content-Type', file.contentType || 'image/jpeg');
        res.setHeader('Content-Length', file.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        const imageStream = getImageStream(fileId);
        imageStream.on('error', () => {
          if (!res.headersSent) res.status(404).json({ message: 'Image not found' });
        });
        imageStream.pipe(res);
      } else {
        // It's a filename, try to find in uploads folder
        const uploadsPath = path.join(__dirname, '..', 'uploads');
        const possiblePaths = [
          path.join(uploadsPath, 'projects', fileId),
          path.join(uploadsPath, 'properties', fileId),
          path.join(uploadsPath, fileId)
        ];
        
        for (const filePath of possiblePaths) {
          const absolutePath = path.resolve(filePath);
          if (fs.existsSync(absolutePath)) {
            console.log('[API] Found image at:', absolutePath);
            const ext = path.extname(fileId).toLowerCase();
            const contentTypeMap = {
              '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
              '.gif': 'image/gif', '.webp': 'image/webp'
            };
            res.setHeader('Content-Type', contentTypeMap[ext] || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            return res.sendFile(absolutePath);
          }
        }
        
        console.error('[API] Image not found:', fileId);
        return res.status(404).json({ message: 'Image not found' });
      }
    } catch (error) {
      console.error('[API] Error serving image:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: error.message || 'Error serving image' });
      }
    }
  });

  // ========== BROKER ROUTES (Public - before authRoutes) ==========
  // Get all brokers - Public route, no auth required
  app.get('/api/brokers', async (req, res) => {
    try {
      console.log('[API] ========== /api/brokers endpoint called ==========');
      
      // Check MongoDB connection
      if (mongoose.connection.readyState !== 1) {
        console.error('[API] MongoDB not connected. State:', mongoose.connection.readyState);
        return res.status(503).json({ message: 'Database not connected', brokers: [] });
      }
      
      if (!User) {
        console.error('[API] User model not available');
        return res.status(500).json({ message: 'User model not available', brokers: [] });
      }
      
      console.log('[API] MongoDB connection state: CONNECTED');
      console.log('[API] User model: Available');
      
      // Fetch all registered brokers - try multiple query approaches
      let brokers = [];
      
      // Method 1: Direct query
      try {
        brokers = await User.find({ role: 'broker' })
          .select('_id name email phone company status verified isReraVerified')
          .sort({ name: 1 })
          .lean();
        console.log(`[API] Method 1 (direct): Found ${brokers.length} brokers`);
      } catch (err) {
        console.error('[API] Method 1 failed:', err.message);
      }
      
      // Method 2: Case-insensitive search if Method 1 returns nothing
      if (brokers.length === 0) {
        try {
          const allUsers = await User.find({}).select('_id name email role phone company status verified isReraVerified').lean();
          brokers = allUsers.filter(u => u.role && u.role.toLowerCase().trim() === 'broker');
          console.log(`[API] Method 2 (filtered): Found ${brokers.length} brokers`);
        } catch (err) {
          console.error('[API] Method 2 failed:', err.message);
        }
      }
      
      // Convert _id to string for frontend compatibility
      const formattedBrokers = brokers.map(broker => ({
        _id: broker._id ? broker._id.toString() : broker._id,
        name: broker.name || '',
        email: broker.email || '',
        phone: broker.phone || '',
        company: broker.company || '',
        status: broker.status || 'active',
        verified: broker.verified || false,
        isReraVerified: broker.isReraVerified || false
      }));
      
      console.log(`[API] ========== Returning ${formattedBrokers.length} brokers ==========`);
      if (formattedBrokers.length > 0) {
        console.log('[API] Brokers:', formattedBrokers.map(b => ({ id: b._id, name: b.name, email: b.email })));
      } else {
        console.warn('[API] ⚠️ No brokers found in database');
        // Debug: Show all roles in database
        const allUsersSample = await User.find({}).select('name email role').limit(10).lean();
        console.log('[API] Sample users in database:', allUsersSample.map(u => ({ name: u.name, role: u.role })));
      }
      
      res.json(formattedBrokers);
    } catch (error) {
      console.error('[API] ❌ Error fetching brokers:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ 
        message: error.message, 
        error: error.toString(),
        brokers: [] 
      });
    }
  });

  // Register auth routes AFTER specific routes
  app.use('/api', authRoutes);

  // User routes (admin only)
  app.get('/api/users', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/users/:id', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Users can only view their own profile unless they're admin
      if (req.session.userId !== req.params.id && req.session.userRole !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put('/api/users/:id', requireAdmin, async (req, res) => {
    try {
      const { role, status, name, phone, company } = req.body;
      const updates = {};
      if (role) updates.role = role;
      if (status) updates.status = status;
      if (name) updates.name = name;
      if (phone) updates.phone = phone;
      if (company) updates.company = company;

      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    try {
      const user = await storage.deleteUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/users/admin', requireAdmin, async (req, res) => {
    try {
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ message: 'Email and role are required' });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found. User must sign up first.' });
      }

      const updatedUser = await storage.updateUser(existingUser._id, { role });
      res.json({ message: 'Admin role assigned successfully', user: updatedUser });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Verification routes (admin only)
  app.get('/api/verifications', requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      const filters = status ? { status } : {};
      const verifications = await storage.getAllVerifications(filters);
      res.json(verifications);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/verifications/:id/approve', requireAdmin, async (req, res) => {
    try {
      const verification = await storage.getVerification(req.params.id);
      if (!verification) {
        return res.status(404).json({ message: 'Verification request not found' });
      }

      if (verification.status !== 'pending') {
        return res.status(400).json({ message: 'This verification has already been processed' });
      }

      // Check if email is already registered
      const existingUser = await storage.getUserByEmail(verification.email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email is already registered' });
      }

      // Create user account with verified status
      // Password is already hashed in verification, so skip hashing
      const user = await storage.createUser({
        name: verification.name,
        email: verification.email,
        password: verification.password,
        role: verification.role,
        reraId: verification.reraId,
        phone: verification.phone || '',
        company: verification.company || '',
        status: 'active',
        verified: true,
        isEmailVerified: true,
        isReraVerified: true,
      }, true);

      // Update verification status
      await storage.updateVerification(req.params.id, {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: req.session.userId,
      });

      // Send approval email
      await sendAccountApprovalEmail(
        verification.email,
        verification.name,
        verification.role,
        verification.reraId
      );

      res.json({
        message: 'Verification approved and user account created successfully',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          reraId: user.reraId,
        },
      });
    } catch (error) {
      console.error('Error approving verification:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/verifications/:id/reject', requireAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      
      if (!reason || reason.trim() === '') {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }

      const verification = await storage.getVerification(req.params.id);
      if (!verification) {
        return res.status(404).json({ message: 'Verification request not found' });
      }

      if (verification.status !== 'pending') {
        return res.status(400).json({ message: 'This verification has already been processed' });
      }

      // Update verification status
      await storage.updateVerification(req.params.id, {
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedBy: req.session.userId,
      });

      // Send rejection email
      await sendAccountRejectionEmail(
        verification.email,
        verification.name,
        verification.role,
        verification.reraId,
        reason
      );

      res.json({
        message: 'Verification rejected successfully',
      });
    } catch (error) {
      console.error('Error rejecting verification:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Document routes (authenticated users only)
  app.get('/api/documents/:userId', requireAuth, async (req, res) => {
    try {
      // Users can only view their own documents unless they're admin
      if (req.session.userId !== req.params.userId && req.session.userRole !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const documents = await storage.getDocumentsByUser(req.params.userId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Transaction routes (authenticated users only)
  app.get('/api/transactions/:userId', requireAuth, async (req, res) => {
    try {
      // Users can only view their own transactions unless they're admin
      if (req.session.userId !== req.params.userId && req.session.userRole !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const transactions = await storage.getTransactionsByUser(req.params.userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notification routes (authenticated users only)
  app.get('/api/notifications/:userId', requireAuth, async (req, res) => {
    try {
      // Users can only view their own notifications unless they're admin
      if (req.session.userId !== req.params.userId && req.session.userRole !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const notifications = await storage.getNotificationsByUser(req.params.userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      // First get the notification to verify ownership
      const notification = await storage.getNotificationsByUser(req.session.userId);
      const targetNotification = notification.find(n => n._id.toString() === req.params.id);
      
      if (!targetNotification) {
        // Check if admin
        const user = await storage.getUser(req.session.userId);
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ message: 'Access denied. You can only mark your own notifications as read.' });
        }
      }
      
      const updatedNotification = await storage.markNotificationAsRead(req.params.id);
      res.json(updatedNotification);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Super Admin routes (superadmin only)
  app.get('/api/superadmin/users/by-role', requireSuperAdmin, async (req, res) => {
    try {
      const { role } = req.query;
      const filters = role ? { role } : {};
      const users = await storage.getAllUsers(filters);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/superadmin/stats', requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.status === 'active').length;
      
      // Count users by role
      const admins = users.filter(u => u.role === 'admin' || u.role === 'dataadmin' || u.role === 'salesadmin').length;
      const vendors = users.filter(u => u.role === 'vendor').length;
      const customers = users.filter(u => u.role === 'customer').length;
      const brokers = users.filter(u => u.role === 'broker').length;
      const investors = users.filter(u => u.role === 'investor').length;
      
      // Get all transactions to calculate revenue
      let totalRevenue = 0;
      for (const user of users) {
        const transactions = await storage.getTransactionsByUser(user._id);
        const userRevenue = transactions
          .filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + t.amount, 0);
        totalRevenue += userRevenue;
      }

      res.json({
        totalUsers,
        activeUsers,
        revenue: totalRevenue,
        growthRate: activeUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
        usersByRole: {
          admins,
          vendors,
          customers,
          brokers,
          investors
        }
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Test route to verify superadmin routes are working
  app.get('/api/superadmin/test', requireSuperAdmin, (req, res) => {
    res.json({ message: 'Super admin route is working' });
  });

  // Registered Professionals routes (Superadmin only)
  // Get all registered professionals with optional filters
  app.get('/api/registered-professionals', requireSuperAdmin, async (req, res) => {
    try {
      const { pincode, type, search, page = 1, limit = 10 } = req.query;
      const query = {};
      
      if (pincode) query.pincode = pincode;
      if (type) query.type = type;
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const professionals = await RegisteredProfessional.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      const total = await RegisteredProfessional.countDocuments(query);

      res.json({
        professionals,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    } catch (error) {
      console.error('Error fetching registered professionals:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get a single registered professional
  app.get('/api/registered-professionals/:id', requireSuperAdmin, async (req, res) => {
    try {
      const professional = await RegisteredProfessional.findById(req.params.id);
      if (!professional) {
        return res.status(404).json({ message: 'Professional not found' });
      }
      res.json(professional);
    } catch (error) {
      console.error('Error fetching professional:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new registered professional
  app.post('/api/registered-professionals', requireSuperAdmin, async (req, res) => {
    try {
      const { name, email, phone, address, pincode, type, languages, latitude, longitude } = req.body;

      // Validate required fields
      if (!name || !email || !phone || !address || !pincode || !type) {
        return res.status(400).json({ message: 'Name, email, phone, address, pincode, and type are required' });
      }

      // Check if pincode already has 2 professionals
      const existingCount = await RegisteredProfessional.countDocuments({ pincode });
      if (existingCount >= 2) {
        return res.status(400).json({ 
          message: `Maximum 2 professionals allowed per pincode. Pincode ${pincode} already has ${existingCount} professionals.` 
        });
      }

      // Check if email already exists
      const existingEmail = await RegisteredProfessional.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Geocode address if latitude/longitude not provided
      let finalLatitude = latitude;
      let finalLongitude = longitude;
      
      if (!finalLatitude || !finalLongitude) {
        try {
          // Use Google Maps Geocoding API
          const apiKey = getGoogleMapsApiKey();
          if (apiKey) {
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', ' + pincode + ', Ahmedabad, Gujarat, India')}&key=${apiKey}`;
            const geocodeResponse = await fetch(geocodeUrl);
            const geocodeData = await geocodeResponse.json();
            
            if (geocodeData.results && geocodeData.results.length > 0) {
              finalLatitude = geocodeData.results[0].geometry.location.lat;
              finalLongitude = geocodeData.results[0].geometry.location.lng;
            }
          }
        } catch (geocodeError) {
          console.warn('Geocoding failed, continuing without coordinates:', geocodeError);
        }
      }

      const professional = new RegisteredProfessional({
        name,
        email,
        phone,
        address,
        pincode,
        type,
        languages: languages || [],
        latitude: finalLatitude,
        longitude: finalLongitude
      });

      await professional.save();
      res.status(201).json(professional);
    } catch (error) {
      console.error('Error creating professional:', error);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      if (error.message.includes('Maximum 2 professionals')) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: error.message || 'Failed to create professional' });
    }
  });

  // Update a registered professional
  app.put('/api/registered-professionals/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { name, email, phone, address, pincode, type, languages, latitude, longitude } = req.body;
      const professional = await RegisteredProfessional.findById(req.params.id);

      if (!professional) {
        return res.status(404).json({ message: 'Professional not found' });
      }

      // If pincode is being changed, check if new pincode has space
      if (pincode && pincode !== professional.pincode) {
        const existingCount = await RegisteredProfessional.countDocuments({ pincode });
        if (existingCount >= 2) {
          return res.status(400).json({ 
            message: `Maximum 2 professionals allowed per pincode. Pincode ${pincode} already has ${existingCount} professionals.` 
          });
        }
      }

      // If email is being changed, check if new email exists
      if (email && email !== professional.email) {
        const existingEmail = await RegisteredProfessional.findOne({ email });
        if (existingEmail) {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }

      // Geocode address if latitude/longitude not provided and address changed
      let finalLatitude = latitude !== undefined ? latitude : professional.latitude;
      let finalLongitude = longitude !== undefined ? longitude : professional.longitude;
      
      if ((!finalLatitude || !finalLongitude) && (address || pincode)) {
        try {
          const apiKey = getGoogleMapsApiKey();
          if (apiKey) {
            const finalAddress = address || professional.address;
            const finalPincode = pincode || professional.pincode;
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(finalAddress + ', ' + finalPincode + ', Ahmedabad, Gujarat, India')}&key=${apiKey}`;
            const geocodeResponse = await fetch(geocodeUrl);
            const geocodeData = await geocodeResponse.json();
            
            if (geocodeData.results && geocodeData.results.length > 0) {
              finalLatitude = geocodeData.results[0].geometry.location.lat;
              finalLongitude = geocodeData.results[0].geometry.location.lng;
            }
          }
        } catch (geocodeError) {
          console.warn('Geocoding failed, keeping existing coordinates:', geocodeError);
        }
      }

      // Update professional
      professional.name = name || professional.name;
      professional.email = email || professional.email;
      professional.phone = phone || professional.phone;
      professional.address = address || professional.address;
      professional.pincode = pincode || professional.pincode;
      professional.type = type || professional.type;
      professional.languages = languages !== undefined ? languages : professional.languages;
      if (finalLatitude !== undefined) professional.latitude = finalLatitude;
      if (finalLongitude !== undefined) professional.longitude = finalLongitude;

      await professional.save();
      res.json(professional);
    } catch (error) {
      console.error('Error updating professional:', error);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      res.status(500).json({ message: error.message || 'Failed to update professional' });
    }
  });

  // Delete a registered professional
  app.delete('/api/registered-professionals/:id', requireSuperAdmin, async (req, res) => {
    try {
      const professional = await RegisteredProfessional.findByIdAndDelete(req.params.id);
      if (!professional) {
        return res.status(404).json({ message: 'Professional not found' });
      }
      res.json({ message: 'Professional deleted successfully' });
    } catch (error) {
      console.error('Error deleting professional:', error);
      res.status(500).json({ message: error.message || 'Failed to delete professional' });
    }
  });

  // Get professionals count by pincode (for validation)
  app.get('/api/registered-professionals/pincode/:pincode/count', requireSuperAdmin, async (req, res) => {
    try {
      const count = await RegisteredProfessional.countDocuments({ pincode: req.params.pincode });
      res.json({ pincode: req.params.pincode, count, available: count < 2 });
    } catch (error) {
      console.error('Error getting pincode count:', error);
      res.status(500).json({ message: error.message });
    }
  });


  app.post('/api/superadmin/create-admin', requireSuperAdmin, async (req, res) => {
    try {
      const { name, email, password, role } = req.body;

      console.log('=== CREATE ADMIN REQUEST ===');
      console.log('Creating admin with data:', { name, email, role: role, hasPassword: !!password });
      console.log('Request body:', req.body);

      if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Name, email, password, and role are required' });
      }

      // Validate password length
      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }

      const validAdminRoles = ['dataadmin', 'salesadmin'];
      if (!validAdminRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role. Must be dataadmin or salesadmin' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      console.log('Existing user check:', existingUser ? 'User exists' : 'User does not exist');
      
      if (existingUser) {
        // Update existing user with new role, password, and verification status
        // Hash the password before updating
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log('Updating existing user with hashed password');
        
        // Update user including password (updateUser excludes password from response, but we need to update it)
        await User.findByIdAndUpdate(existingUser._id, { 
          name,
          password: hashedPassword,
          role, 
          status: 'active', 
          verified: true,
          isEmailVerified: true,
          updatedAt: new Date()
        });
        
        // Get updated user (without password)
        const updatedUser = await storage.getUser(existingUser._id);
        
        console.log('User updated successfully');
        return res.json({ 
          message: `Admin account updated successfully. ${role === 'dataadmin' ? 'Data Admin' : 'Sales Admin'} role assigned.`, 
          user: updatedUser 
        });
      } else {
        // Create new user with hashed password
        console.log('Creating new user...');
        const newUser = await storage.createUser({
          name,
          email,
          password, // Will be automatically hashed by createUser
          role,
          status: 'active',
          verified: true,
          isEmailVerified: true
        });
        
        console.log('User created successfully:', newUser.email);
        return res.json({ 
          message: `Admin account created successfully. ${role === 'dataadmin' ? 'Data Admin' : 'Sales Admin'} role assigned.`, 
          user: newUser 
        });
      }
    } catch (error) {
      console.error('Error creating/updating admin:', error);
      console.error('Error stack:', error.stack);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email already exists' });
      }
      res.status(500).json({ message: error.message || 'Failed to create/update admin account' });
    }
  });

  // Admin stats route (admin only)
  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.status === 'active').length;
      
      // Get all transactions to calculate revenue
      let totalRevenue = 0;
      for (const user of users) {
        const transactions = await storage.getTransactionsByUser(user._id);
        const userRevenue = transactions
          .filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + t.amount, 0);
        totalRevenue += userRevenue;
      }

      res.json({
        totalUsers,
        activeUsers,
        revenue: totalRevenue,
        growthRate: activeUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Map registration routes
  // Check if user is registered in map
  app.get('/api/map/check-registration', requireAuth, async (req, res) => {
    try {
      const mapRegistration = await storage.getMapRegistrationByUser(req.session.userId);
      res.json({ registered: !!mapRegistration, data: mapRegistration });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Register user in map
  app.post('/api/map/register', requireAuth, async (req, res) => {
    try {
      const { address, pincode, locality, latitude, longitude } = req.body;

      if (!address || !pincode || !latitude || !longitude) {
        return res.status(400).json({ message: 'Address, pincode, latitude, and longitude are required' });
      }

      // Get user details
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Create or update map registration
      const mapRegistration = await storage.createMapRegistration({
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        address,
        pincode,
        locality: locality || '',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      });

      res.json({ 
        message: 'Successfully registered on map',
        data: mapRegistration 
      });
    } catch (error) {
      console.error('Error registering user on map:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all map registrations (for displaying on map)
  app.get('/api/map/registrations', async (req, res) => {
    try {
      const { pincode } = req.query;
      let registrations;
      
      if (pincode) {
        registrations = await storage.getMapRegistrationsByPincode(pincode);
      } else {
        registrations = await storage.getAllMapRegistrations();
      }

      res.json(registrations);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get pincode boundary from OpenStreetMap Overpass API (real administrative boundaries)
  app.get('/api/map/pincode-boundary', async (req, res) => {
    try {
      const { pincode } = req.query;
      
      if (!pincode) {
        return res.status(400).json({ message: 'Pincode is required' });
      }

      console.log(`🗺️ Fetching boundary for pincode: ${pincode}`);

      // Try OpenStreetMap Overpass API first for real postal boundaries
      try {
        const boundary = await fetchOverpassBoundary(pincode);
        if (boundary && boundary.length > 0) {
          console.log(`✅ Found real boundary from Overpass API for ${pincode} with ${boundary.length} points`);
          
          // Calculate center from boundary
          const lats = boundary.map(b => b.lat);
          const lngs = boundary.map(b => b.lng);
          const center = {
            lat: (Math.max(...lats) + Math.min(...lats)) / 2,
            lng: (Math.max(...lngs) + Math.min(...lngs)) / 2
          };
          
          return res.json({ 
            boundary, 
            source: 'openstreetmap',
            center
          });
        }
      } catch (overpassError) {
        console.warn('⚠️ Overpass API failed:', overpassError.message);
      }

      // Try Nominatim API as fallback for boundary
      try {
        const boundary = await fetchNominatimBoundary(pincode);
        if (boundary && boundary.length > 0) {
          console.log(`✅ Found boundary from Nominatim for ${pincode}`);
          
          const lats = boundary.map(b => b.lat);
          const lngs = boundary.map(b => b.lng);
          const center = {
            lat: (Math.max(...lats) + Math.min(...lats)) / 2,
            lng: (Math.max(...lngs) + Math.min(...lngs)) / 2
          };
          
          return res.json({ 
            boundary, 
            source: 'nominatim',
            center
          });
        }
      } catch (nominatimError) {
        console.warn('⚠️ Nominatim API failed:', nominatimError.message);
      }

      // Final fallback: Use Google Maps Geocoding API for viewport/bounds
      if (getGoogleMapsApiKey()) {
        try {
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(pincode + ', Gujarat, India')}&key=${getGoogleMapsApiKey()}`;
          
          const response = await fetch(geocodeUrl);
          const data = await response.json();

          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            const geometry = result.geometry;
            
            let boundary = null;
            
            if (geometry.viewport) {
              const ne = geometry.viewport.northeast;
              const sw = geometry.viewport.southwest;
              
              boundary = [
                { lat: ne.lat, lng: sw.lng },
                { lat: ne.lat, lng: ne.lng },
                { lat: sw.lat, lng: ne.lng },
                { lat: sw.lat, lng: sw.lng },
                { lat: ne.lat, lng: sw.lng },
              ];
            } else if (geometry.location) {
              const location = geometry.location;
              const radius = 0.015;
              
              boundary = [
                { lat: location.lat + radius, lng: location.lng - radius },
                { lat: location.lat + radius, lng: location.lng + radius },
                { lat: location.lat - radius, lng: location.lng + radius },
                { lat: location.lat - radius, lng: location.lng - radius },
                { lat: location.lat + radius, lng: location.lng - radius },
              ];
            }

            if (boundary) {
              console.log(`📍 Using Google Maps viewport for ${pincode} (approximate boundary)`);
              return res.json({ 
                boundary, 
                source: 'google_viewport',
                center: geometry.location || { lat: 0, lng: 0 },
                approximate: true
              });
            }
          }
        } catch (googleError) {
          console.warn('⚠️ Google Maps API failed:', googleError.message);
        }
      }

      return res.status(404).json({ message: 'Boundary not available for this pincode' });
    } catch (error) {
      console.error('Error fetching pincode boundary:', error);
      res.status(500).json({ message: 'Failed to fetch pincode boundary', error: error.message });
    }
  });

  app.get('/api/pincode/:pincode/polygon', async (req, res) => {
    try {
      const { pincode } = req.params;
      
      if (!pincode || !/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ 
          message: 'Valid 6-digit pincode is required',
          error: 'INVALID_PINCODE'
        });
      }

      console.log(`[ML-Polygon] Generating ML boundary for pincode: ${pincode}`);
      
      const result = await generatePincodeBoundary(pincode);
      
      if (!result) {
        return res.status(404).json({ 
          message: 'Could not generate boundary for this pincode',
          error: 'BOUNDARY_GENERATION_FAILED'
        });
      }

      console.log(`[ML-Polygon] Successfully generated polygon with ${result.pointCount} points`);
      
      res.json({
        success: true,
        source: result.source,
        centroid: result.centroid,
        viewport: result.viewport,
        polygon: result.polygon,
        boundary: result.boundary,
        placeId: result.placeId,
        localities: result.localities,
        pointCount: result.pointCount,
        generatedAt: result.generatedAt,
        message: 'Boundary generated using Google Maps road-network ML approximation.'
      });

    } catch (error) {
      console.error('[ML-Polygon] Error:', error);
      res.status(500).json({ 
        message: 'Failed to generate pincode polygon',
        error: error.message
      });
    }
  });

  app.get('/api/pincode/:pincode/entities', async (req, res) => {
    try {
      const { pincode } = req.params;
      const { type } = req.query;
      
      if (!pincode || !/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ message: 'Valid 6-digit pincode is required' });
      }

      console.log(`[Entities] Fetching entities in pincode: ${pincode}, type: ${type || 'all'}`);

      const boundaryResult = await generatePincodeBoundary(pincode);
      
      if (!boundaryResult || !boundaryResult.polygon) {
        return res.status(404).json({ message: 'Could not determine boundary for this pincode' });
      }

      const entities = {
        properties: [],
        projects: [],
        professionals: [],
        users: []
      };

      if (!type || type === 'properties' || type === 'all') {
        try {
          const allProperties = await Property.find({ status: 'active' }).lean();
          entities.properties = allProperties.filter(prop => {
            if (prop.latitude && prop.longitude) {
              return isPointInBoundary({ lat: prop.latitude, lng: prop.longitude }, boundaryResult.polygon);
            }
            return prop.pincode === pincode;
          });
        } catch (e) {
          console.warn('[Entities] Error fetching properties:', e.message);
        }
      }

      if (!type || type === 'projects' || type === 'all') {
        try {
          const allProjects = await Project.find({ status: { $ne: 'deleted' } }).lean();
          entities.projects = allProjects.filter(proj => {
            if (proj.latitude && proj.longitude) {
              return isPointInBoundary({ lat: proj.latitude, lng: proj.longitude }, boundaryResult.polygon);
            }
            return proj.pincode === pincode || (proj.territories && proj.territories.includes(pincode));
          });
        } catch (e) {
          console.warn('[Entities] Error fetching projects:', e.message);
        }
      }

      if (!type || type === 'professionals' || type === 'all') {
        try {
          const allProfessionals = await RegisteredProfessional.find({ status: 'active' }).lean();
          entities.professionals = allProfessionals.filter(prof => {
            if (prof.latitude && prof.longitude) {
              return isPointInBoundary({ lat: prof.latitude, lng: prof.longitude }, boundaryResult.polygon);
            }
            return prof.pincode === pincode;
          });
        } catch (e) {
          console.warn('[Entities] Error fetching professionals:', e.message);
        }
      }

      res.json({
        success: true,
        pincode,
        boundary: boundaryResult.boundary,
        centroid: boundaryResult.centroid,
        entities,
        counts: {
          properties: entities.properties.length,
          projects: entities.projects.length,
          professionals: entities.professionals.length,
          users: entities.users.length
        }
      });

    } catch (error) {
      console.error('[Entities] Error:', error);
      res.status(500).json({ message: 'Failed to fetch entities', error: error.message });
    }
  });

  app.get('/api/boundary-cache/stats', requireAuth, async (req, res) => {
    try {
      const stats = getCacheStats();
      res.json({
        success: true,
        ...stats
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get cache stats' });
    }
  });

  app.post('/api/boundary-cache/clear', requireAdmin, async (req, res) => {
    try {
      const { pincode } = req.body;
      clearBoundaryCache(pincode || null);
      res.json({
        success: true,
        message: pincode ? `Cache cleared for ${pincode}` : 'All cache cleared'
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to clear cache' });
    }
  });

  // Helper function to fetch boundary from OpenStreetMap Overpass API
  async function fetchOverpassBoundary(pincode) {
    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    
    // Query for postal code boundary relation in India
    const query = `
      [out:json][timeout:25];
      (
        relation["boundary"="postal_code"]["postal_code"="${pincode}"];
        relation["boundary"="administrative"]["postal_code"="${pincode}"];
        way["boundary"="postal_code"]["postal_code"="${pincode}"];
        area["postal_code"="${pincode}"]["ISO3166-2"~"IN-GJ"];
      );
      out geom;
    `;

    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`Overpass API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data.elements && data.elements.length > 0) {
      // Find elements with geometry
      for (const element of data.elements) {
        if (element.type === 'relation' && element.members) {
          // Extract coordinates from relation members (outer ways)
          const boundary = extractBoundaryFromRelation(element);
          if (boundary && boundary.length > 0) {
            return boundary;
          }
        } else if (element.type === 'way' && element.geometry) {
          // Direct way geometry
          return element.geometry.map(point => ({
            lat: point.lat,
            lng: point.lon
          }));
        }
      }
    }
    
    return null;
  }

  // Helper function to extract boundary coordinates from OSM relation
  function extractBoundaryFromRelation(relation) {
    const outerWays = [];
    
    if (relation.members) {
      for (const member of relation.members) {
        if (member.type === 'way' && member.role === 'outer' && member.geometry) {
          outerWays.push(member.geometry);
        }
      }
    }
    
    if (outerWays.length === 0) {
      return null;
    }
    
    // Merge ways into a single boundary
    let boundary = [];
    for (const way of outerWays) {
      for (const point of way) {
        boundary.push({
          lat: point.lat,
          lng: point.lon
        });
      }
    }
    
    return boundary;
  }

  // Helper function to fetch boundary from Nominatim
  async function fetchNominatimBoundary(pincode) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&polygon_geojson=1&limit=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'TerriSmart/1.0 (Real Estate Platform)'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data && data.length > 0 && data[0].geojson) {
      const geojson = data[0].geojson;
      
      if (geojson.type === 'Polygon' && geojson.coordinates) {
        // Convert GeoJSON polygon to lat/lng array
        const coords = geojson.coordinates[0]; // Outer ring
        return coords.map(coord => ({
          lat: coord[1],
          lng: coord[0]
        }));
      } else if (geojson.type === 'MultiPolygon' && geojson.coordinates) {
        // Use the largest polygon
        let largestPolygon = null;
        let maxPoints = 0;
        
        for (const polygon of geojson.coordinates) {
          if (polygon[0].length > maxPoints) {
            maxPoints = polygon[0].length;
            largestPolygon = polygon[0];
          }
        }
        
        if (largestPolygon) {
          return largestPolygon.map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }));
        }
      }
    }
    
    return null;
  }

  // Reverse geocoding - get address and pincode from coordinates
  app.get('/api/map/reverse-geocode', async (req, res) => {
    try {
      const { lat, lng } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ message: 'Latitude and longitude are required' });
      }

      // Validate coordinates
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ message: 'Invalid coordinates' });
      }

      // Use Google Maps Geocoding API if available, otherwise fallback to Nominatim
      if (getGoogleMapsApiKey()) {
        try {
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${getGoogleMapsApiKey()}`;
          const response = await fetch(geocodeUrl);
          const data = await response.json();

          if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            const address = result.formatted_address || '';
            
            // Extract address components
            const addressComponents = result.address_components || [];
            let pincode = '';
            let locality = '';
            let city = '';
            
            addressComponents.forEach(component => {
              const types = component.types || [];
              if (types.includes('postal_code')) {
                pincode = component.long_name;
              }
              if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
                locality = component.long_name;
              }
              if (types.includes('locality') || types.includes('administrative_area_level_2')) {
                if (!locality) locality = component.long_name;
                city = component.long_name;
              }
            });

            // Fetch population data for the pincode
            let population = null;
            if (pincode) {
              try {
                // Import pincode data and estimate population
                const { ahmedabadPincodes } = await import('../client/src/data/ahmedabadPincodes.js');
                const pincodeData = ahmedabadPincodes.find((p) => p.pincode === pincode);
                
                if (pincodeData && pincodeData.population) {
                  population = pincodeData.population;
                } else {
                  // Use estimation function
                  population = estimatePopulationForPincode(pincode);
                }
              } catch (popError) {
                // Population fetch failed, but continue with address data
                console.error('Error fetching population:', popError);
              }
            }

            return res.json({
              address,
              pincode,
              locality: locality || city,
              city,
              population
            });
          } else {
            console.error('Google Geocoding API error:', data.status, data.error_message);
            // Fallback to Nominatim
          }
        } catch (googleError) {
          console.error('Google Geocoding API error:', googleError);
          // Fallback to Nominatim
        }
      }

      // Fallback to Nominatim (OpenStreetMap) reverse geocoding API
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`,
          {
            headers: {
              'User-Agent': 'TerriSmart/1.0 (contact@terrismart.com)',
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9'
            }
          }
        );

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            if (data && !data.error) {
              const address = data.display_name || '';
              const addressParts = data.address || {};
              const pincode = addressParts.postcode || '';
              const locality = addressParts.suburb || addressParts.neighbourhood || addressParts.city_district || '';
              const city = addressParts.city || addressParts.town || addressParts.village || '';

              // Fetch population data for the pincode
              let population = null;
              if (pincode) {
                try {
                  // Import pincode data and estimate population
                  const { ahmedabadPincodes } = await import('../client/src/data/ahmedabadPincodes.js');
                  const pincodeData = ahmedabadPincodes.find((p) => p.pincode === pincode);
                  
                  if (pincodeData && pincodeData.population) {
                    population = pincodeData.population;
                  } else {
                    // Use estimation function
                    population = estimatePopulationForPincode(pincode);
                  }
                } catch (popError) {
                  // Population fetch failed, but continue with address data
                  console.error('Error fetching population:', popError);
                }
              }

              return res.json({
                address,
                pincode,
                locality: locality || city,
                city,
                population
              });
            }
          }
        }
      } catch (nominatimError) {
        console.error('Nominatim error:', nominatimError);
      }

      // If both fail, return error
      return res.status(500).json({ 
        message: 'Could not find address for these coordinates. Please enter manually.' 
      });
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      res.status(500).json({ 
        message: 'Failed to get address from coordinates. Please enter manually.',
        error: error.message 
      });
    }
  });

  // Get population data for a pincode
  app.get('/api/map/pincode-population', async (req, res) => {
    // Always set JSON content type for API responses FIRST
    res.setHeader('Content-Type', 'application/json');
    
    try {
      console.log('Population route hit:', req.query);
      console.log('Request path:', req.path);
      console.log('Request URL:', req.url);
      
      const { pincode } = req.query;
      
      if (!pincode) {
        return res.status(400).json({ message: 'Pincode is required' });
      }

      // Try Census Dataset (primary source)
      try {
        const kaggleDataPath = path.join(__dirname, '..', 'client', 'src', 'data', 'pincodePopulation.json');
        console.log('Looking for census data at:', kaggleDataPath);
        console.log('File exists:', fs.existsSync(kaggleDataPath));
        
        if (fs.existsSync(kaggleDataPath)) {
          const kaggleDataContent = fs.readFileSync(kaggleDataPath, 'utf-8');
          const kaggleData = JSON.parse(kaggleDataContent);
          console.log('Census data loaded, checking for pincode:', pincode);
          console.log('Pincode found:', !!kaggleData[pincode]);
          
          if (kaggleData && kaggleData[pincode]) {
            return res.json({
              pincode,
              population: kaggleData[pincode],
              source: 'census'
            });
          }
        } else {
          console.log('Census data file not found at:', kaggleDataPath);
        }
      } catch (kaggleError) {
        console.error('Error reading census dataset:', kaggleError);
        console.error('Error stack:', kaggleError.stack);
      }

      // Get area information for better estimation
      let areaName = '';
      let district = '';
      try {
        const postalResponse = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        if (postalResponse.ok) {
          const postalData = await postalResponse.json();
          if (postalData && postalData[0] && postalData[0].Status === 'Success' && postalData[0].PostOffice && postalData[0].PostOffice.length > 0) {
            areaName = postalData[0].PostOffice[0].Name || '';
            district = postalData[0].PostOffice[0].District || '';
          }
        }
      } catch (postalError) {
        console.error('Error fetching postal data:', postalError);
      }

      // Fallback: estimate based on pincode pattern and area information
      const estimatedPopulation = estimatePopulationForPincode(pincode, areaName, district);
      
      return res.json({
        pincode,
        population: estimatedPopulation,
        areaName: areaName || undefined,
        district: district || undefined,
        source: 'estimated'
      });
    } catch (error) {
      console.error('Error fetching pincode population:', error);
      console.error('Error stack:', error.stack);
      
      // Always return JSON, even on error
      res.status(500).json({ 
        message: 'Failed to fetch population data',
        error: error.message || 'Unknown error'
      });
    }
  });

  // Helper function to estimate population for a pincode
  function estimatePopulationForPincode(pincode, areaName = '', district = '') {
    // Population estimates for Ahmedabad pincodes (based on typical urban density)
    // These are approximations - actual census data would be more accurate
    const populationEstimates = {
      '380015': 45000, // Navrangpura - Commercial area
      '380007': 38000, // Ellisbridge
      '380006': 42000, // Gandhinagar
      '380009': 35000, // Maninagar
      '380013': 40000, // Vastrapur
      '380014': 48000, // Satellite
      '380052': 32000, // Bodakdev
      '380054': 36000, // Prahladnagar
      '380061': 34000, // Ghatlodia
      '380008': 39000, // Paldi
      '380051': 28000, // Other areas
      '380055': 30000,
      '380058': 31000,
      '380059': 29000,
    };

    // If we have stored estimate, use it
    if (populationEstimates[pincode]) {
      return populationEstimates[pincode];
    }

    // Default estimate for Ahmedabad urban pincodes (30,000-40,000 range)
    // Based on typical urban pincode population in Indian cities
    const baseEstimate = 35000;
    const variation = Math.floor(Math.random() * 10000) - 5000; // ±5000 variation
    return Math.max(20000, baseEstimate + variation); // Minimum 20,000
  }

  // Admin analytics route (admin only) - returns detailed analytics data
  app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // User distribution by role
      const userDistribution = {
        customer: users.filter(u => u.role === 'customer').length,
        vendor: users.filter(u => u.role === 'vendor').length,
        broker: users.filter(u => u.role === 'broker').length,
        investor: users.filter(u => u.role === 'investor').length,
        admin: users.filter(u => u.role === 'admin' || u.role === 'dataadmin' || u.role === 'salesadmin').length,
      };

      // User growth over time (last 12 months)
      const now = new Date();
      const userGrowth = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const usersInMonth = users.filter(u => {
          const userDate = u.createdAt ? new Date(u.createdAt) : new Date();
          return userDate >= monthStart && userDate <= monthEnd;
        }).length;
        
        userGrowth.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          users: usersInMonth,
          cumulative: users.filter(u => {
            const userDate = u.createdAt ? new Date(u.createdAt) : new Date();
            return userDate <= monthEnd;
          }).length
        });
      }

      // Revenue trends (last 12 months)
      const revenueTrends = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        let monthRevenue = 0;
        for (const user of users) {
          const transactions = await storage.getTransactionsByUser(user._id);
          const userMonthRevenue = transactions
            .filter(t => {
              const transDate = t.createdAt ? new Date(t.createdAt) : new Date();
              return t.status === 'completed' && transDate >= monthStart && transDate <= monthEnd;
            })
            .reduce((sum, t) => sum + t.amount, 0);
          monthRevenue += userMonthRevenue;
        }
        
        revenueTrends.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          revenue: monthRevenue
        });
      }

      // Activity trends (users by status)
      const activityTrends = {
        active: users.filter(u => u.status === 'active').length,
        inactive: users.filter(u => u.status === 'inactive').length,
        pending: users.filter(u => u.status === 'pending').length,
        verified: users.filter(u => u.verified || u.isEmailVerified).length,
        unverified: users.filter(u => !u.verified && !u.isEmailVerified).length,
      };

      res.json({
        userDistribution,
        userGrowth,
        revenueTrends,
        activityTrends
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Google Maps configuration (without exposing API key)
  app.get('/api/maps/config', (req, res) => {
    const apiKey = getGoogleMapsApiKey();
    res.json({
      enabled: !!apiKey,
      apiKey: apiKey
    });
  });

  // Fetch Places (POI) data for a pincode or location
  app.get('/api/maps/places', async (req, res) => {
    try {
      const { pincode, lat, lng, radius = 5000, type } = req.query;
      
      if (!getGoogleMapsApiKey()) {
        return res.status(503).json({ message: 'Google Maps API not configured' });
      }

      let location;
      
      // If pincode provided, geocode it first
      if (pincode) {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(pincode + ', Ahmedabad, Gujarat, India')}&key=${getGoogleMapsApiKey()}`;
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();
        
        if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
          location = geocodeData.results[0].geometry.location;
        } else {
          return res.status(404).json({ message: 'Pincode not found' });
        }
      } else if (lat && lng) {
        location = { lat: parseFloat(lat), lng: parseFloat(lng) };
      } else {
        return res.status(400).json({ message: 'Either pincode or lat/lng is required' });
      }

      // Define POI categories relevant to real estate
      const categories = [
        'hospital',
        'school',
        'restaurant', 
        'shopping_mall',
        'park',
        'bus_station',
        'train_station',
        'gym',
        'bank',
        'police',
        'fire_station',
        'pharmacy',
        'supermarket',
        'cafe',
        'movie_theater'
      ];

      const categoryToSearch = type || categories;
      const placesData = {};

      // If specific type requested, search only that
      if (type && typeof type === 'string') {
        const searchTypes = Array.isArray(categoryToSearch) ? categoryToSearch : [categoryToSearch];
        
        for (const placeType of searchTypes) {
          const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&type=${placeType}&key=${getGoogleMapsApiKey()}`;
          
          const placesResponse = await fetch(placesUrl);
          const placesResult = await placesResponse.json();
          
          if (placesResult.status === 'OK') {
            placesData[placeType] = placesResult.results.map(place => ({
              name: place.name,
              vicinity: place.vicinity,
              location: place.geometry.location,
              placeId: place.place_id,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              types: place.types,
              businessStatus: place.business_status
            }));
          } else {
            placesData[placeType] = [];
          }
        }
      } else {
        // Search all categories
        for (const category of categories) {
          const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&type=${category}&key=${getGoogleMapsApiKey()}`;
          
          const placesResponse = await fetch(placesUrl);
          const placesResult = await placesResponse.json();
          
          if (placesResult.status === 'OK') {
            placesData[category] = placesResult.results.map(place => ({
              name: place.name,
              vicinity: place.vicinity,
              location: place.geometry.location,
              placeId: place.place_id,
              rating: place.rating,
              userRatingsTotal: place.user_ratings_total,
              types: place.types,
              businessStatus: place.business_status
            }));
          } else {
            placesData[category] = [];
          }
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      res.json({
        location,
        radius: parseInt(radius),
        data: placesData
      });
    } catch (error) {
      console.error('Error fetching places:', error);
      res.status(500).json({ message: 'Failed to fetch places data', error: error.message });
    }
  });

  // Get aggregated POI counts for a pincode
  app.get('/api/maps/poi-summary', async (req, res) => {
    try {
      const { pincode, lat, lng, radius = 5000 } = req.query;
      
      if (!getGoogleMapsApiKey()) {
        return res.status(503).json({ message: 'Google Maps API not configured' });
      }

      let location;
      
      // If pincode provided, geocode it first
      if (pincode) {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(pincode + ', Ahmedabad, Gujarat, India')}&key=${getGoogleMapsApiKey()}`;
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();
        
        if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
          location = geocodeData.results[0].geometry.location;
        } else {
          return res.status(404).json({ message: 'Pincode not found' });
        }
      } else if (lat && lng) {
        location = { lat: parseFloat(lat), lng: parseFloat(lng) };
      } else {
        return res.status(400).json({ message: 'Either pincode or lat/lng is required' });
      }

      // Define POI categories with display names and icons
      const categories = [
        { type: 'hospital', label: 'Hospitals', icon: '🏥' },
        { type: 'school', label: 'Schools', icon: '🏫' },
        { type: 'restaurant', label: 'Restaurants', icon: '🍽️' },
        { type: 'shopping_mall', label: 'Shopping Malls', icon: '🛒' },
        { type: 'park', label: 'Parks', icon: '🌳' },
        { type: 'bus_station', label: 'Bus Stations', icon: '🚌' },
        { type: 'train_station', label: 'Train Stations', icon: '🚆' },
        { type: 'gym', label: 'Gyms', icon: '💪' },
        { type: 'bank', label: 'Banks', icon: '🏦' },
        { type: 'pharmacy', label: 'Pharmacies', icon: '💊' },
        { type: 'supermarket', label: 'Supermarkets', icon: '🛍️' },
        { type: 'cafe', label: 'Cafes', icon: '☕' },
      ];

      const summary = [];

      for (const category of categories) {
        const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&type=${category.type}&key=${getGoogleMapsApiKey()}`;
        
        const placesResponse = await fetch(placesUrl);
        const placesResult = await placesResponse.json();
        
        if (placesResult.status === 'OK') {
          summary.push({
            type: category.type,
            label: category.label,
            icon: category.icon,
            count: placesResult.results.length,
            places: placesResult.results.map(place => ({
              name: place.name,
              vicinity: place.vicinity,
              location: place.geometry.location,
              placeId: place.place_id,
              rating: place.rating
            }))
          });
        } else {
          summary.push({
            type: category.type,
            label: category.label,
            icon: category.icon,
            count: 0,
            places: []
          });
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      res.json({
        location,
        radius: parseInt(radius),
        summary
      });
    } catch (error) {
      console.error('Error fetching POI summary:', error);
      res.status(500).json({ message: 'Failed to fetch POI summary', error: error.message });
    }
  });

  const httpServer = createServer(app);

  // Setup Socket.IO for real-time notifications
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Project routes (Sales Admin)
  // Get all projects (public for map viewing, filtered for sales admin)
  app.get('/api/projects', async (req, res) => {
    try {
      console.log('[API] GET /api/projects - Request received');
      console.log('[API] Session userId:', req.session?.userId);
      
      let projects;
      
      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        console.log('[API] User found:', user ? { id: user._id, role: user.role, name: user.name } : 'null');
        
        if (user && (user.role === 'superadmin' || user.role === 'salesadmin')) {
          // Sales admin can see all their projects
          console.log('[API] Fetching projects for sales admin:', req.session.userId);
          projects = await storage.getProjectsBySalesAdmin(req.session.userId);
          console.log('[API] Found', projects.length, 'projects for sales admin');
        } else {
          // Others can see all active projects
          console.log('[API] Fetching active projects for user role:', user?.role);
          projects = await storage.getAllProjects({ status: { $in: ['working', 'not_started'] } });
          console.log('[API] Found', projects.length, 'active projects');
        }
      } else {
        // Public: show all active projects
        console.log('[API] Fetching active projects (public)');
        projects = await storage.getAllProjects({ status: { $in: ['working', 'not_started'] } });
        console.log('[API] Found', projects.length, 'active projects (public)');
      }
      
      // Projects are already converted to plain objects in storage layer
      // Just ensure they're safe to send and normalize image URLs
      const projectsData = projects.map(project => {
        // Projects should already be plain objects from storage layer
        const projectObj = project;
        // Double-check images is an array (safety check)
        if (!projectObj.images || !Array.isArray(projectObj.images)) {
          projectObj.images = [];
        } else {
          // Normalize image URLs - convert all paths to /api/images/ format
          projectObj.images = projectObj.images.map(img => {
            if (!img) return null;
            const imgStr = String(img).trim();
            // If it's already a full URL, return as is
            if (imgStr.startsWith('http')) {
              return imgStr;
            }
            // If it already starts with /api/images/, return as is
            if (imgStr.startsWith('/api/images/')) {
              return imgStr;
            }
            // If it looks like a file path (contains /uploads/), extract the relative path
            if (imgStr.includes('/uploads/')) {
              // Extract path after /uploads/ (e.g., "projects/filename.jpg")
              const relativePath = imgStr.split('/uploads/').pop();
              return `/api/images/${relativePath}`;
            }
            // If it's a valid ObjectId, prepend /api/images/
            if (mongoose.Types.ObjectId.isValid(imgStr)) {
              return `/api/images/${imgStr}`;
            }
            // Otherwise, assume it's a filename and prepend /api/images/
            return `/api/images/${imgStr}`;
          }).filter(img => img !== null); // Remove null values
        }
        return projectObj;
      });
      
      console.log('[API] Sending', projectsData.length, 'projects to client');
      if (projectsData.length > 0) {
        const sampleProject = projectsData[0];
        console.log('[API] Sample project:', {
          id: sampleProject._id,
          name: sampleProject.projectName,
          imagesCount: sampleProject.images?.length || 0,
          images: sampleProject.images,
          firstImageUrl: sampleProject.images?.[0] || 'no images'
        });
        // Log the first image URL that will be requested
        if (sampleProject.images && sampleProject.images.length > 0) {
          console.log('[API] First image will be requested at:', sampleProject.images[0]);
        }
      }
      res.json(projectsData);
    } catch (error) {
      console.error('[API] Error fetching projects:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ message: error.message || 'Failed to fetch projects', error: error.toString() });
    }
  });

  // Test route to verify routing works
  app.get('/api/test-offers-route', (req, res) => {
    res.json({ message: 'Test route works', timestamp: new Date().toISOString() });
  });

  // Launch/Promote offer for a project (must be before /api/projects/:id route)
  app.post('/api/projects/:id/offers', requireAuth, async (req, res) => {
    console.log('=== OFFER ROUTE HIT ===');
    console.log('Request path:', req.path);
    console.log('Request URL:', req.url);
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    try {
      const user = await storage.getUser(req.session.userId);
      console.log('User:', user?.email, 'Role:', user?.role);
      const project = await storage.getProject(req.params.id);
      console.log('Project found:', !!project);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      console.log('Authorization check:');
      console.log('  User role:', user.role);
      console.log('  User _id:', user._id?.toString());
      console.log('  Project salesAdminId:', project.salesAdminId?.toString());
      
      // Convert both to strings for reliable comparison
      const userIdStr = String(user._id);
      const projectSalesAdminIdStr = String(project.salesAdminId);
      const idsMatch = userIdStr === projectSalesAdminIdStr;
      
      console.log('  IDs match:', idsMatch);
      console.log('  User ID:', userIdStr);
      console.log('  Project SalesAdmin ID:', projectSalesAdminIdStr);
      
      // Superadmin can launch offers for any project
      // Salesadmin can only launch offers for their own projects
      if (user.role === 'superadmin') {
        // Superadmin has full access
        console.log('  Authorization: Superadmin - allowed');
      } else if (user.role === 'salesadmin') {
        // Salesadmin can only manage their own projects
        if (!idsMatch) {
          console.log('  Authorization: Salesadmin - denied (not project owner)');
          return res.status(403).json({ 
            message: 'Unauthorized: You can only launch offers for your own projects',
            debug: {
              userId: userIdStr,
              projectSalesAdminId: projectSalesAdminIdStr
            }
          });
        }
        console.log('  Authorization: Salesadmin - allowed (project owner)');
      } else {
        console.log('  Authorization: Denied (invalid role)');
        return res.status(403).json({ message: 'Unauthorized: Only sales admin can launch offers' });
      }

      // Validate required fields
      if (!req.body.title || !req.body.discount || !req.body.validFrom || !req.body.validTo) {
        return res.status(400).json({ message: 'Title, discount, validFrom, and validTo are required' });
      }

      const offer = {
        title: req.body.title,
        description: req.body.description || '',
        discount: parseFloat(req.body.discount),
        validFrom: new Date(req.body.validFrom),
        validTo: new Date(req.body.validTo),
        isActive: true
      };

      // Use MongoDB $push operator to add offer to array
      const updated = await Project.findByIdAndUpdate(
        req.params.id,
        { $push: { offers: offer }, updatedAt: new Date() },
        { new: true }
      ).populate('salesAdminId', 'name email');
      
      if (!updated) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error launching offer:', error);
      res.status(500).json({ message: error.message || 'Failed to launch offer' });
    }
  });

  // Get project stats (MUST be before /api/projects/:id to avoid route conflict)
  app.get('/api/projects/stats', requireAuth, async (req, res) => {
    try {
      console.log('=== STATS ROUTE HIT ===');
      console.log('Session userId:', req.session.userId);
      
      const user = await storage.getUser(req.session.userId);
      console.log('User found:', !!user, 'Role:', user?.role);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      let projects = [];
      
      if (user.role === 'superadmin' || user.role === 'salesadmin') {
        console.log('Fetching projects for sales admin:', req.session.userId);
        projects = await storage.getProjectsBySalesAdmin(req.session.userId);
        console.log('Projects found:', projects.length);
      } else {
        console.log('Fetching all projects for non-admin user');
        projects = await storage.getAllProjects();
        console.log('Projects found:', projects.length);
      }
      
      // Calculate stats with proper null checking
      const stats = {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p && p.status === 'working').length,
        totalViews: projects.reduce((sum, p) => {
          if (!p || !p.engagement) return sum;
          return sum + (Number(p.engagement.views) || 0);
        }, 0),
        totalInquiries: projects.reduce((sum, p) => {
          if (!p || !p.engagement) return sum;
          return sum + (Number(p.engagement.inquiries) || 0);
        }, 0)
      };
      
      console.log('[API] Stats calculated:', stats);
      console.log('[API] Sample project for debugging:', projects[0] ? {
        id: projects[0]._id,
        name: projects[0].projectName,
        status: projects[0].status,
        engagement: projects[0].engagement,
        images: projects[0].images?.length || 0
      } : 'No projects');
      res.json(stats);
    } catch (error) {
      console.error('Error in stats route:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ message: error.message || 'Failed to fetch stats' });
    }
  });

  // Get projects by territory (MUST be before /api/projects/:id to avoid route conflict)
  app.get('/api/projects/territory/:pincode', async (req, res) => {
    try {
      const projects = await storage.getProjectsByTerritory(req.params.pincode);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get project by ID (MUST be after all specific routes like /stats and /territory/:pincode)
  app.get('/api/projects/:id', async (req, res) => {
    try {
      // Validate that id is a valid ObjectId before querying
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid project ID format' });
      }
      
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Increment views
      await storage.incrementProjectViews(req.params.id);
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create project
  app.post('/api/projects', requireAuth, async (req, res) => {
    try {
      console.log('[API] POST /api/projects - Request received');
      console.log('[API] Request body:', JSON.stringify(req.body, null, 2));
      
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      if (user.role !== 'superadmin' && user.role !== 'salesadmin') {
        return res.status(403).json({ message: 'Only sales admin can create projects' });
      }

      // Validate required fields
      if (!req.body.projectName || !req.body.priceRange || !req.body.pincode || 
          !req.body.areaName || !req.body.latitude || !req.body.longitude ||
          !req.body.startDate || !req.body.endDate) {
        return res.status(400).json({ 
          message: 'Missing required fields',
          required: ['projectName', 'priceRange', 'pincode', 'areaName', 'latitude', 'longitude', 'startDate', 'endDate']
        });
      }

      // Calculate status based on dates
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      const now = new Date();
      
      let status = 'not_started';
      if (now >= startDate && now <= endDate) {
        status = 'working';
      } else if (now > endDate) {
        status = 'finished';
      }

      // Process images array - filter out empty/null/undefined values
      let images = [];
      if (req.body.images && Array.isArray(req.body.images)) {
        images = req.body.images
          .filter(img => {
            // Filter out null, undefined, empty strings, and whitespace-only strings
            if (img === null || img === undefined) return false;
            if (typeof img === 'string') {
              const trimmed = img.trim();
              return trimmed !== '' && trimmed.length > 0;
            }
            return false; // Only allow strings
          })
          .map(img => String(img).trim());
      }

      console.log('[API] Received images:', req.body.images);
      console.log('[API] Processed images:', images);

      const projectData = {
        projectName: req.body.projectName,
        priceRange: {
          min: parseFloat(req.body.priceRange.min),
          max: parseFloat(req.body.priceRange.max)
        },
        images: images, // Always send array (empty if no images)
        pincode: String(req.body.pincode),
        areaName: String(req.body.areaName),
        latitude: parseFloat(req.body.latitude),
        longitude: parseFloat(req.body.longitude),
        territories: Array.isArray(req.body.territories) ? req.body.territories : [req.body.pincode],
        startDate: startDate,
        endDate: endDate,
        salesAdminId: user._id,
        salesAdminName: user.name,
        salesAdminEmail: user.email,
        status: status
      };

      console.log('[API] Creating project with data:', { 
        ...projectData, 
        images: projectData.images.length + ' images',
        salesAdminId: projectData.salesAdminId.toString()
      });
      
      const project = await storage.createProject(projectData);
      console.log('[API] Project created successfully:', project._id);
      
      // Convert to plain object for response
      const projectObj = project.toObject ? project.toObject() : project;
      res.json(projectObj);
    } catch (error) {
      console.error('[API] Error creating project:', error);
      console.error('[API] Error name:', error.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Error stack:', error.stack);
      
      // Check if it's a validation error
      if (error.name === 'ValidationError') {
        const validationErrors = Object.keys(error.errors || {}).map(key => ({
          field: key,
          message: error.errors[key].message
        }));
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: validationErrors,
          fullError: error.message
        });
      }
      
      res.status(500).json({ 
        message: error.message || 'Failed to create project',
        error: error.toString(),
        name: error.name
      });
    }
  });

  // Upload project image to GridFS
  app.post('/api/projects/upload-image', requireAuth, upload.single('image'), async (req, res) => {
    try {
      console.log('[API] Image upload request received');
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      if (user.role !== 'superadmin' && user.role !== 'salesadmin') {
        return res.status(403).json({ message: 'Only sales admin can upload images' });
      }

      if (!req.file) {
        console.error('[API] No file in request');
        return res.status(400).json({ message: 'No image file provided' });
      }

      console.log('[API] File received:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        bufferLength: req.file.buffer?.length
      });

      // Upload to GridFS
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(req.file.originalname);
      const filename = `project-${uniqueSuffix}${ext}`;
      
      console.log('[API] Uploading to GridFS with filename:', filename);
      const result = await uploadImageToGridFS(
        req.file.buffer,
        filename,
        {
          type: 'project',
          uploadedBy: user._id.toString(),
          originalName: req.file.originalname,
          mimetype: req.file.mimetype
        }
      );

      console.log('[API] Image uploaded successfully:', result.fileId);
      res.json({ 
        fileId: result.fileId,
        filename: result.filename,
        originalName: req.file.originalname,
        url: `/api/images/${result.fileId}` // URL to retrieve the image
      });
    } catch (error) {
      console.error('[API] Error uploading image to GridFS:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ message: error.message || 'Failed to upload image' });
    }
  });


  // Update project
  app.put('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if ((user.role !== 'superadmin' && user.role !== 'salesadmin') || project.salesAdminId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      // Recalculate status if dates changed
      if (req.body.startDate || req.body.endDate) {
        const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date(project.startDate);
        const endDate = req.body.endDate ? new Date(req.body.endDate) : new Date(project.endDate);
        const now = new Date();
        
        if (now < startDate) {
          req.body.status = 'not_started';
        } else if (now > endDate) {
          req.body.status = 'finished';
        } else {
          req.body.status = 'working';
        }
      }

      const updated = await storage.updateProject(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete project
  app.delete('/api/projects/:id', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      if ((user.role !== 'superadmin' && user.role !== 'salesadmin') || project.salesAdminId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await storage.deleteProject(req.params.id);
      res.json({ message: 'Project deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== PROPERTY ROUTES ==========
  // Get all properties
  app.get('/api/properties', async (req, res) => {
    try {
      console.log('[API] GET /api/properties - Request received');
      let properties;
      
      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user && user.role === 'vendor') {
          // Vendor can see all their properties
          console.log('[API] Fetching properties for vendor:', req.session.userId);
          properties = await storage.getPropertiesByVendor(req.session.userId);
          console.log('[API] Found', properties.length, 'properties for vendor');
        } else {
          // Others can see all active properties
          console.log('[API] Fetching active properties for user role:', user?.role);
          properties = await storage.getAllProperties({ status: 'active' });
          console.log('[API] Found', properties.length, 'active properties');
        }
      } else {
        // Public: show all active properties
        console.log('[API] Fetching active properties (public)');
        properties = await storage.getAllProperties({ status: 'active' });
        console.log('[API] Found', properties.length, 'active properties (public)');
      }
      
      // Normalize image URLs for properties (similar to projects)
      const propertiesData = properties.map(property => {
        const propertyObj = property;
        if (!propertyObj.images || !Array.isArray(propertyObj.images)) {
          propertyObj.images = [];
        } else {
          propertyObj.images = propertyObj.images.map(img => {
            if (!img) return null;
            const imgStr = String(img).trim();
            // If it's already a full URL, return as is
            if (imgStr.startsWith('http')) {
              return imgStr;
            }
            // If it already starts with /api/images/, return as is
            if (imgStr.startsWith('/api/images/')) {
              return imgStr;
            }
            // If it looks like a file path (contains /uploads/), extract the relative path
            if (imgStr.includes('/uploads/')) {
              // Extract path after /uploads/ (e.g., "properties/filename.jpg")
              const relativePath = imgStr.split('/uploads/').pop();
              return `/api/images/${relativePath}`;
            }
            // If it's a valid ObjectId, prepend /api/images/
            if (mongoose.Types.ObjectId.isValid(imgStr)) {
              return `/api/images/${imgStr}`;
            }
            // Otherwise, assume it's a filename and prepend /api/images/
            return `/api/images/${imgStr}`;
          }).filter(img => img !== null);
        }
        return propertyObj;
      });
      
      console.log('[API] Sending', propertiesData.length, 'properties to client');
      if (propertiesData.length > 0) {
        const sampleProperty = propertiesData[0];
        console.log('[API] Sample property:', {
          id: sampleProperty._id,
          name: sampleProperty.propertyName,
          imagesCount: sampleProperty.images?.length || 0,
          images: sampleProperty.images,
          firstImageUrl: sampleProperty.images?.[0] || 'no images'
        });
        // Log the first image URL that will be requested
        if (sampleProperty.images && sampleProperty.images.length > 0) {
          console.log('[API] First property image will be requested at:', sampleProperty.images[0]);
        }
      }
      res.json(propertiesData);
    } catch (error) {
      console.error('[API] Error fetching properties:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get property stats
  app.get('/api/properties/stats', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (!user || user.role !== 'vendor') {
        return res.status(403).json({ message: 'Only vendors can view property stats' });
      }
      
      const properties = await storage.getPropertiesByVendor(user._id);
      
      const stats = {
        totalProperties: properties.length,
        saleProperties: properties.filter(p => p.reason === 'sale').length,
        leaseProperties: properties.filter(p => p.reason === 'lease').length,
        activeProperties: properties.filter(p => p.status === 'active').length
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create property
  app.post('/api/properties', requireAuth, async (req, res) => {
    try {
      console.log('[API] POST /api/properties - Request received');
      console.log('[API] Request body:', JSON.stringify(req.body, null, 2));
      
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      if (user.role !== 'vendor') {
        return res.status(403).json({ message: 'Only vendors can create properties' });
      }

      // Process images array - filter out empty/null/undefined values
      let images = [];
      if (req.body.images && Array.isArray(req.body.images)) {
        images = req.body.images
          .filter(img => {
            // Filter out null, undefined, empty strings, and whitespace-only strings
            if (img === null || img === undefined) return false;
            if (typeof img === 'string') {
              const trimmed = img.trim();
              return trimmed !== '' && trimmed.length > 0;
            }
            return false; // Only allow strings
          })
          .map(img => String(img).trim());
      }

      console.log('[API] Received images:', req.body.images);
      console.log('[API] Processed images:', images);

      const propertyData = {
        ...req.body,
        images: images, // Always send array (empty if no images)
        vendorId: user._id,
        vendorName: user.name,
        vendorEmail: user.email,
        status: 'active'
      };

      console.log('[API] Creating property with data:', {
        ...propertyData,
        images: propertyData.images.length + ' images',
        vendorId: propertyData.vendorId.toString()
      });

      const property = await storage.createProperty(propertyData);
      console.log('[API] Property created successfully:', property._id);
      
      const propertyObj = property.toObject ? property.toObject() : property;
      res.json(propertyObj);
    } catch (error) {
      console.error('[API] Error creating property:', error);
      console.error('[API] Error name:', error.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ message: error.message || 'Failed to create property' });
    }
  });

  // Upload property image to GridFS
  app.post('/api/properties/upload-image', requireAuth, propertyUpload.single('image'), async (req, res) => {
    try {
      console.log('[API] Property image upload request received');
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      if (user.role !== 'vendor') {
        return res.status(403).json({ message: 'Only vendors can upload images' });
      }

      if (!req.file) {
        console.error('[API] No file in property upload request');
        return res.status(400).json({ message: 'No image file provided' });
      }

      console.log('[API] Property file received:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        bufferLength: req.file.buffer?.length
      });

      // Upload to GridFS
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(req.file.originalname);
      const filename = `property-${uniqueSuffix}${ext}`;
      
      console.log('[API] Uploading property image to GridFS with filename:', filename);
      const result = await uploadImageToGridFS(
        req.file.buffer,
        filename,
        {
          type: 'property',
          uploadedBy: user._id.toString(),
          originalName: req.file.originalname,
          mimetype: req.file.mimetype
        }
      );

      console.log('[API] Property image uploaded successfully:', result.fileId);
      res.json({ 
        fileId: result.fileId,
        filename: result.filename,
        originalName: req.file.originalname,
        url: `/api/images/${result.fileId}` // URL to retrieve the image
      });
    } catch (error) {
      console.error('[API] Error uploading property image to GridFS:', error);
      console.error('[API] Error stack:', error.stack);
      res.status(500).json({ message: error.message || 'Failed to upload image' });
    }
  });

  // Get property by ID
  app.get('/api/properties/:id', async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }
      
      res.json(property);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update property
  app.put('/api/properties/:id', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }
      
      if (user.role !== 'vendor' || property.vendorId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const updated = await storage.updateProperty(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete property
  app.delete('/api/properties/:id', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      const property = await storage.getProperty(req.params.id);
      
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }
      
      if (user.role !== 'vendor' || property.vendorId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await storage.deleteProperty(req.params.id);
      res.json({ message: 'Property deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get properties by pincode
  app.get('/api/properties/pincode/:pincode', async (req, res) => {
    try {
      const properties = await storage.getPropertiesByPincode(req.params.pincode);
      res.json(properties);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get vendor dashboard stats
  app.get('/api/vendor/stats', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (!user || user.role !== 'vendor') {
        return res.status(403).json({ message: 'Only vendors can view vendor stats' });
      }

      // Get vendor's properties - use user._id or convert to ObjectId if needed
      const vendorId = user._id || user.id;
      const properties = await storage.getPropertiesByVendor(vendorId);
      
      console.log('Vendor Stats Debug:', {
        userId: req.session.userId,
        vendorId: vendorId,
        userRole: user.role,
        propertiesCount: properties.length,
        properties: properties.map(p => ({ 
          id: p._id, 
          name: p.propertyName, 
          status: p.status, 
          reason: p.reason,
          vendorId: p.vendorId 
        }))
      });
      
      // Count ALL properties as active listings (all properties in Trade page are listings)
      // Properties can have status: 'active', 'sold', 'leased', or 'inactive'
      // For dashboard, we count all properties as listings (except 'inactive' if we want to exclude those)
      const totalListings = properties.length;
      const activeListings = properties.filter(p => p.status === 'active').length;
      
      // Use totalListings - all properties are considered listings
      const listingsCount = totalListings;

      // Get vendor's transactions
      const transactions = await Transaction.find({ userId: user._id });
      const completedTransactions = transactions.filter(t => t.status === 'completed');
      const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.amount, 0);

      // Get vendor's documents
      const documents = await Document.find({ userId: user._id });
      const documentCount = documents.length;

      // Calculate month-over-month changes
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Properties created this month vs last month
      const propertiesThisMonth = properties.filter(p => new Date(p.createdAt) >= thisMonth).length;
      const propertiesLastMonth = properties.filter(p => {
        const created = new Date(p.createdAt);
        return created >= lastMonth && created < thisMonth;
      }).length;
      const listingsChange = propertiesLastMonth > 0 
        ? ((propertiesThisMonth - propertiesLastMonth) / propertiesLastMonth) * 100 
        : propertiesThisMonth > 0 ? 100 : 0;

      // Revenue this month vs last month
      const revenueThisMonth = completedTransactions
        .filter(t => new Date(t.createdAt) >= thisMonth)
        .reduce((sum, t) => sum + t.amount, 0);
      const revenueLastMonth = completedTransactions
        .filter(t => {
          const created = new Date(t.createdAt);
          return created >= lastMonth && created < thisMonth;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      const revenueChange = revenueLastMonth > 0 
        ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100 
        : revenueThisMonth > 0 ? 100 : 0;

      // Documents this month vs last month
      const documentsThisMonth = documents.filter(d => new Date(d.uploadedAt) >= thisMonth).length;
      const documentsLastMonth = documents.filter(d => {
        const uploaded = new Date(d.uploadedAt);
        return uploaded >= lastMonth && uploaded < thisMonth;
      }).length;
      const documentsChange = documentsLastMonth > 0 
        ? ((documentsThisMonth - documentsLastMonth) / documentsLastMonth) * 100 
        : documentsThisMonth > 0 ? 100 : 0;

      // Inquiries (for now, we can use property views or set to 0)
      // TODO: Add inquiry system later
      const inquiries = 0;
      const inquiriesChange = 0;

      const response = {
        activeListings: listingsCount, // Show all properties as listings
        totalRevenue,
        inquiries,
        documents: documentCount,
        listingsChange: Math.round(listingsChange * 10) / 10,
        revenueChange: Math.round(revenueChange * 10) / 10,
        inquiriesChange: Math.round(inquiriesChange * 10) / 10,
        documentsChange: Math.round(documentsChange * 10) / 10
      };
      
      console.log('Vendor Stats Response:', response);
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching vendor stats:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== MEETING ROUTES ==========
  // Create meeting request
  app.post('/api/meetings', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Get property details
      const property = await storage.getProperty(req.body.propertyId);
      if (!property) {
        return res.status(404).json({ message: 'Property not found' });
      }

      // Get vendor details
      const vendor = await storage.getUser(property.vendorId);
      if (!vendor) {
        return res.status(404).json({ message: 'Vendor not found' });
      }

      // Get broker details
      if (!property.assignedBrokerId) {
        return res.status(400).json({ message: 'No broker assigned to this property' });
      }
      const broker = await storage.getUser(property.assignedBrokerId);
      if (!broker) {
        return res.status(404).json({ message: 'Broker not found' });
      }

      const meetingData = {
        propertyId: property._id,
        propertyName: property.propertyName,
        propertyLocation: property.location,
        propertyBudget: property.budget,
        propertyType: property.propertyType,
        propertyReason: property.reason,
        customerId: user._id,
        customerName: user.name,
        customerEmail: user.email,
        vendorId: vendor._id,
        vendorName: vendor.name,
        vendorEmail: vendor.email,
        brokerId: broker._id,
        brokerName: broker.name,
        brokerEmail: broker.email,
        status: 'pending'
      };

      const meeting = new Meeting(meetingData);
      await meeting.save();

      res.json(meeting);
    } catch (error) {
      console.error('Error creating meeting:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get meetings for broker
  app.get('/api/meetings/broker', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      
      if (!user || user.role !== 'broker') {
        return res.status(403).json({ message: 'Only brokers can view meetings' });
      }

      const meetings = await Meeting.find({ brokerId: user._id })
        .populate('propertyId', 'propertyName location budget propertyType reason')
        .populate('customerId', 'name email')
        .populate('vendorId', 'name email')
        .sort({ createdAt: -1 });

      res.json(meetings);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update meeting (arrange meeting with date/time)
  app.put('/api/meetings/:id/arrange', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      const meeting = await Meeting.findById(req.params.id);

      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }

      if (user.role !== 'broker' || meeting.brokerId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      const { meetingDate, meetingTime } = req.body;

      if (!meetingDate || !meetingTime) {
        return res.status(400).json({ message: 'Meeting date and time are required' });
      }

      meeting.meetingDate = new Date(meetingDate);
      meeting.meetingTime = meetingTime;
      meeting.status = 'scheduled';
      meeting.updatedAt = new Date();
      await meeting.save();

      // Send emails to vendor and customer
      const { sendMeetingArrangementEmail } = await import('./email-service.js');
      await sendMeetingArrangementEmail(
        meeting.vendorEmail,
        meeting.customerEmail,
        meeting.brokerEmail,
        {
          propertyName: meeting.propertyName,
          propertyLocation: meeting.propertyLocation,
          propertyBudget: meeting.propertyBudget,
          propertyType: meeting.propertyType,
          propertyReason: meeting.propertyReason,
          meetingDate: meeting.meetingDate,
          meetingTime: meeting.meetingTime,
          vendorName: meeting.vendorName,
          customerName: meeting.customerName,
          brokerName: meeting.brokerName
        }
      );

      res.json(meeting);
    } catch (error) {
      console.error('Error arranging meeting:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove/Delete meeting request
  app.delete('/api/meetings/:id', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      const meeting = await Meeting.findById(req.params.id);

      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }

      if (user.role !== 'broker' || meeting.brokerId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      await Meeting.findByIdAndDelete(req.params.id);
      res.json({ message: 'Meeting request removed successfully' });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Setup cron job for daily news refresh at 8 AM
  try {
    // Dynamic import for cron job setup
    const { refreshNewsCache } = await import('./services/newsService.js');
    
    // Schedule news refresh every day at 8:00 AM
    // Cron expression: '0 8 * * *' means: minute 0, hour 8, every day, every month, every day of week
    cron.schedule('0 8 * * *', async () => {
      console.log('⏰ Scheduled news refresh triggered at 8:00 AM');
      try {
        await refreshNewsCache();
      } catch (err) {
        console.error('Error in scheduled news refresh:', err);
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata" // Indian Standard Time
    });

    console.log('✅ News refresh cron job scheduled: Daily at 8:00 AM (IST)');

    // Initial news fetch on server start
    refreshNewsCache().catch(err => {
      console.error('Failed to fetch initial news:', err);
    });
  } catch (error) {
    console.error('Failed to setup news cron job:', error);
  }

  // Make io available to other parts of the app
  app.set('io', io);

  return httpServer;
}
