import { User, Document, Transaction, Notification, OTP, Verification, Map, Project, Property } from "../shared/schema.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

export class MongoStorage {
  // User methods
  async getUser(id) {
    return await User.findById(id).select('-password');
  }

  async getUserByEmail(email) {
    return await User.findOne({ email });
  }

  async createUser(userData, skipPasswordHash = false) {
    // Handle OAuth users (no password) or regular users
    let password = '';
    if (userData.password && userData.password.trim() !== '') {
      password = skipPasswordHash 
        ? userData.password 
        : await bcrypt.hash(userData.password, 10);
    }
    
    const user = new User({
      ...userData,
      password: password || undefined, // Only set password if provided
    });
    return await user.save();
  }

  async updateUser(id, updates) {
    return await User.findByIdAndUpdate(id, { ...updates, updatedAt: Date.now() }, { new: true }).select('-password');
  }

  async deleteUser(id) {
    return await User.findByIdAndDelete(id);
  }

  async getAllUsers(filters = {}) {
    return await User.find(filters).select('-password');
  }

  // OTP methods
  async createOTP(otpData) {
    await OTP.deleteMany({ email: otpData.email, type: otpData.type });
    const otp = new OTP(otpData);
    return await otp.save();
  }

  async getOTP(email, code, type) {
    return await OTP.findOne({ 
      email, 
      code, 
      type,
      expiresAt: { $gt: new Date() }
    });
  }

  async getOTPByEmail(email, type) {
    return await OTP.findOne({ 
      email, 
      type,
      expiresAt: { $gt: new Date() }
    });
  }

  async incrementOTPAttempt(id) {
    return await OTP.findByIdAndUpdate(
      id, 
      { $inc: { attempts: 1 } }, 
      { new: true }
    );
  }

  async deleteOTP(id) {
    return await OTP.findByIdAndDelete(id);
  }

  async deleteOTPsByEmail(email) {
    return await OTP.deleteMany({ email });
  }

  // Document methods
  async createDocument(docData) {
    const document = new Document(docData);
    return await document.save();
  }

  async getDocumentsByUser(userId) {
    return await Document.find({ userId });
  }

  async updateDocumentStatus(id, status) {
    return await Document.findByIdAndUpdate(id, { status }, { new: true });
  }

  async deleteDocument(id) {
    return await Document.findByIdAndDelete(id);
  }

  // Transaction methods
  async createTransaction(txnData) {
    const transaction = new Transaction(txnData);
    return await transaction.save();
  }

  async getTransactionsByUser(userId) {
    return await Transaction.find({ userId }).sort({ createdAt: -1 });
  }

  async updateTransaction(id, updates) {
    return await Transaction.findByIdAndUpdate(id, updates, { new: true });
  }

  // Notification methods
  async createNotification(notifData) {
    const notification = new Notification(notifData);
    return await notification.save();
  }

  async getNotificationsByUser(userId) {
    return await Notification.find({ userId }).sort({ createdAt: -1 });
  }

  async markNotificationAsRead(id) {
    return await Notification.findByIdAndUpdate(id, { read: true }, { new: true });
  }

  async markAllNotificationsAsRead(userId) {
    return await Notification.updateMany({ userId, read: false }, { read: true });
  }

  async deleteNotification(id) {
    return await Notification.findByIdAndDelete(id);
  }

  // Verification methods
  async createVerification(verificationData) {
    // Hash password to avoid storing plaintext in database
    const hashedPassword = await bcrypt.hash(verificationData.password, 10);
    const verification = new Verification({
      ...verificationData,
      password: hashedPassword,
    });
    return await verification.save();
  }

  async getAllVerifications(filters = {}) {
    return await Verification.find(filters).sort({ submittedAt: -1 });
  }

  async getVerification(id) {
    return await Verification.findById(id);
  }

  async getVerificationByEmail(email) {
    return await Verification.findOne({ email });
  }

  async updateVerification(id, updates) {
    return await Verification.findByIdAndUpdate(id, updates, { new: true });
  }

  async deleteVerification(id) {
    return await Verification.findByIdAndDelete(id);
  }

  // Map methods
  async createMapRegistration(mapData) {
    // Check if user already registered, if yes, update instead
    const existing = await Map.findOne({ userId: mapData.userId });
    if (existing) {
      return await Map.findByIdAndUpdate(
        existing._id,
        { ...mapData, updatedAt: Date.now() },
        { new: true }
      );
    }
    const mapRegistration = new Map(mapData);
    return await mapRegistration.save();
  }

  async getMapRegistrationByUser(userId) {
    return await Map.findOne({ userId });
  }

  async getAllMapRegistrations(filters = {}) {
    return await Map.find(filters).sort({ createdAt: -1 });
  }

  async getMapRegistrationsByPincode(pincode) {
    return await Map.find({ pincode });
  }

  async updateMapRegistration(userId, updates) {
    return await Map.findOneAndUpdate(
      { userId },
      { ...updates, updatedAt: Date.now() },
      { new: true }
    );
  }

  async deleteMapRegistration(userId) {
    return await Map.findOneAndDelete({ userId });
  }

  // Project methods
  async createProject(projectData) {
    try {
      console.log('[Storage] createProject called with:', {
        ...projectData,
        images: projectData.images ? `${projectData.images.length} images` : 'no images'
      });
      
      // Ensure images is always an array, even if empty
      if (!projectData.images || !Array.isArray(projectData.images)) {
        projectData.images = [];
      }
      // Filter out any empty/null/undefined values from images array and ensure all are strings
      const cleanImages = projectData.images
        .filter(img => {
          if (img === null || img === undefined) return false;
          if (typeof img === 'string') {
            return img.trim().length > 0;
          }
          return false; // Only allow strings
        })
        .map(img => String(img).trim());
      
      console.log('[Storage] Processed images array:', cleanImages);
      
      // Prepare project data with cleaned images and proper type conversion
      const finalProjectData = {
        projectName: String(projectData.projectName),
        priceRange: {
          min: parseFloat(projectData.priceRange.min),
          max: parseFloat(projectData.priceRange.max)
        },
        images: cleanImages,
        pincode: String(projectData.pincode),
        areaName: String(projectData.areaName),
        latitude: parseFloat(projectData.latitude),
        longitude: parseFloat(projectData.longitude),
        territories: Array.isArray(projectData.territories) ? projectData.territories.map(t => String(t)) : [String(projectData.pincode)],
        startDate: projectData.startDate instanceof Date ? projectData.startDate : new Date(projectData.startDate),
        endDate: projectData.endDate instanceof Date ? projectData.endDate : new Date(projectData.endDate),
        salesAdminId: (() => {
          if (!projectData.salesAdminId) {
            throw new Error('salesAdminId is required');
          }
          if (mongoose.Types.ObjectId.isValid(projectData.salesAdminId)) {
            return typeof projectData.salesAdminId === 'string' 
              ? new mongoose.Types.ObjectId(projectData.salesAdminId) 
              : projectData.salesAdminId;
          }
          throw new Error(`Invalid salesAdminId: ${projectData.salesAdminId}`);
        })(),
        salesAdminName: String(projectData.salesAdminName),
        salesAdminEmail: String(projectData.salesAdminEmail),
        status: String(projectData.status),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Always initialize engagement object with defaults
      finalProjectData.engagement = {
        views: projectData.engagement?.views ? Number(projectData.engagement.views) : 0,
        inquiries: projectData.engagement?.inquiries ? Number(projectData.engagement.inquiries) : 0,
        lastViewed: projectData.engagement?.lastViewed ? new Date(projectData.engagement.lastViewed) : null
      };
      
      // Add offers array if it exists
      if (projectData.offers && Array.isArray(projectData.offers)) {
        finalProjectData.offers = projectData.offers;
      } else {
        finalProjectData.offers = [];
      }
      
      console.log('[Storage] Final project data prepared, inserting...');
      console.log('[Storage] Data types:', {
        salesAdminId: typeof finalProjectData.salesAdminId,
        startDate: typeof finalProjectData.startDate,
        images: Array.isArray(finalProjectData.images),
        imagesLength: finalProjectData.images.length
      });
      
      // Use insertOne to bypass Mongoose validation
      const result = await Project.collection.insertOne(finalProjectData);
      
      console.log('[Storage] Insert result:', result.insertedId);
      
      // Fetch the created project
      const savedProject = await Project.findById(result.insertedId);
      if (!savedProject) {
        throw new Error('Failed to retrieve created project');
      }
      console.log('[Storage] Project saved successfully:', savedProject._id);
      return savedProject;
    } catch (error) {
      console.error('[Storage] Error in createProject:', error);
      console.error('[Storage] Error details:', {
        name: error.name,
        message: error.message,
        errors: error.errors,
        code: error.code
      });
      throw error;
    }
  }

  async getProject(id) {
    return await Project.findById(id).populate('salesAdminId', 'name email');
  }

  async getAllProjects(filters = {}) {
    try {
      console.log('[Storage] getAllProjects called with filters:', filters);
      
      // Try to find projects, handle populate errors gracefully
      let projects;
      try {
        projects = await Project.find(filters).populate('salesAdminId', 'name email').sort({ createdAt: -1 });
      } catch (populateError) {
        console.warn('[Storage] Populate failed, trying without populate:', populateError.message);
        // If populate fails, try without it
        projects = await Project.find(filters).sort({ createdAt: -1 });
      }
      
      console.log('[Storage] Found', projects.length, 'projects');
      
      // Convert to plain objects manually to handle any schema issues
      const projectsData = projects.map((p, index) => {
        try {
          let obj;
          if (p && p.toObject && typeof p.toObject === 'function') {
            obj = p.toObject({ virtuals: false });
          } else if (p && typeof p === 'object') {
            obj = JSON.parse(JSON.stringify(p)); // Deep clone plain object
          } else {
            console.warn(`[Storage] Project at index ${index} is not a valid object:`, typeof p);
            return null;
          }
          
          // Ensure images is always an array and handle any invalid data
          if (!obj.images) {
            obj.images = [];
          } else if (!Array.isArray(obj.images)) {
            obj.images = [];
          } else {
            // Filter and normalize image URLs
            obj.images = obj.images
              .filter(img => img !== null && img !== undefined && img !== '')
              .map(img => {
                const imgStr = String(img).trim();
                // If it's already a full URL, return as is
                if (imgStr.startsWith('http')) {
                  return imgStr;
                }
                // If it already starts with /api/images/, return as is
                if (imgStr.startsWith('/api/images/')) {
                  return imgStr;
                }
                // If it looks like a file path (contains /uploads/), extract relative path
                if (imgStr.includes('/uploads/')) {
                  // Extract path after /uploads/ (e.g., "projects/filename.jpg" or "properties/filename.jpg")
                  const relativePath = imgStr.split('/uploads/').pop();
                  return `/api/images/${relativePath}`;
                }
                // If it's a valid ObjectId, prepend /api/images/
                if (mongoose.Types.ObjectId.isValid(imgStr)) {
                  return `/api/images/${imgStr}`;
                }
                // Otherwise, assume it's a filename and prepend /api/images/
                return `/api/images/${imgStr}`;
              });
          }
          
          // Ensure engagement object exists with defaults
          if (!obj.engagement) {
            obj.engagement = {
              views: 0,
              inquiries: 0
            };
          } else {
            // Ensure engagement has numeric values
            obj.engagement = {
              views: Number(obj.engagement.views) || 0,
              inquiries: Number(obj.engagement.inquiries) || 0,
              lastViewed: obj.engagement.lastViewed || null
            };
          }
          
          // Ensure _id is a string
          if (obj._id) {
            obj._id = obj._id.toString();
          }
          
          return obj;
        } catch (err) {
          console.error(`[Storage] Error processing project at index ${index}:`, err);
          return null;
        }
      }).filter(p => p !== null);
      
      console.log('[Storage] Returning', projectsData.length, 'processed projects');
      return projectsData;
    } catch (error) {
      console.error('[Storage] Error in getAllProjects:', error);
      console.error('[Storage] Error stack:', error.stack);
      throw error;
    }
  }

  async getProjectsBySalesAdmin(salesAdminId) {
    try {
      console.log('[Storage] getProjectsBySalesAdmin called with salesAdminId:', salesAdminId);
      
      // Convert to ObjectId if it's a string
      let objectId = salesAdminId;
      if (mongoose.Types.ObjectId.isValid(salesAdminId)) {
        objectId = typeof salesAdminId === 'string' ? new mongoose.Types.ObjectId(salesAdminId) : salesAdminId;
      }
      
      console.log('[Storage] Querying with ObjectId:', objectId);
      const projects = await Project.find({ salesAdminId: objectId }).sort({ createdAt: -1 });
      console.log('[Storage] Found', projects.length, 'projects for sales admin');
      
      // Convert to plain objects manually to handle any schema issues
      const projectsData = projects.map((p, index) => {
        try {
          let obj;
          if (p && p.toObject && typeof p.toObject === 'function') {
            obj = p.toObject({ virtuals: false });
          } else if (p && typeof p === 'object') {
            obj = JSON.parse(JSON.stringify(p)); // Deep clone plain object
          } else {
            console.warn(`[Storage] Project at index ${index} is not a valid object:`, typeof p);
            return null;
          }
          
          // Ensure images is always an array and handle any invalid data
          if (!obj.images) {
            obj.images = [];
          } else if (!Array.isArray(obj.images)) {
            obj.images = [];
          } else {
            // Filter and normalize image URLs
            obj.images = obj.images
              .filter(img => img !== null && img !== undefined && img !== '')
              .map(img => {
                const imgStr = String(img).trim();
                // If it's already a full URL, return as is
                if (imgStr.startsWith('http')) {
                  return imgStr;
                }
                // If it already starts with /api/images/, return as is
                if (imgStr.startsWith('/api/images/')) {
                  return imgStr;
                }
                // If it looks like a file path (contains /uploads/), extract relative path
                if (imgStr.includes('/uploads/')) {
                  // Extract path after /uploads/ (e.g., "projects/filename.jpg" or "properties/filename.jpg")
                  const relativePath = imgStr.split('/uploads/').pop();
                  return `/api/images/${relativePath}`;
                }
                // If it's a valid ObjectId, prepend /api/images/
                if (mongoose.Types.ObjectId.isValid(imgStr)) {
                  return `/api/images/${imgStr}`;
                }
                // Otherwise, assume it's a filename and prepend /api/images/
                return `/api/images/${imgStr}`;
              });
          }
          
          // Ensure engagement object exists with defaults
          if (!obj.engagement) {
            obj.engagement = {
              views: 0,
              inquiries: 0
            };
          } else {
            // Ensure engagement has numeric values
            obj.engagement = {
              views: Number(obj.engagement.views) || 0,
              inquiries: Number(obj.engagement.inquiries) || 0,
              lastViewed: obj.engagement.lastViewed || null
            };
          }
          
          // Ensure _id is a string
          if (obj._id) {
            obj._id = obj._id.toString();
          }
          
          return obj;
        } catch (err) {
          console.error(`[Storage] Error processing project at index ${index}:`, err);
          return null;
        }
      }).filter(p => p !== null);
      
      console.log('[Storage] Returning', projectsData.length, 'processed projects');
      return projectsData;
    } catch (error) {
      console.error('[Storage] Error in getProjectsBySalesAdmin:', error);
      console.error('[Storage] Error stack:', error.stack);
      throw error;
    }
  }

  async updateProject(id, updates) {
    return await Project.findByIdAndUpdate(id, { ...updates, updatedAt: Date.now() }, { new: true });
  }

  async deleteProject(id) {
    return await Project.findByIdAndDelete(id);
  }

  async getProjectsByTerritory(pincode) {
    return await Project.find({ 
      $or: [
        { pincode },
        { territories: pincode }
      ]
    }).populate('salesAdminId', 'name email');
  }

  async incrementProjectViews(id) {
    return await Project.findByIdAndUpdate(
      id,
      { 
        $inc: { 'engagement.views': 1 },
        'engagement.lastViewed': new Date()
      },
      { new: true }
    );
  }

  async incrementProjectInquiries(id) {
    return await Project.findByIdAndUpdate(
      id,
      { $inc: { 'engagement.inquiries': 1 } },
      { new: true }
    );
  }

  // Property methods
  async createProperty(propertyData) {
    try {
      console.log('[Storage] createProperty called with:', {
        ...propertyData,
        images: propertyData.images ? `${propertyData.images.length} images` : 'no images'
      });
      
      // Ensure images is always an array, even if empty
      if (!propertyData.images || !Array.isArray(propertyData.images)) {
        propertyData.images = [];
      }
      // Filter out any empty/null/undefined values from images array and ensure all are strings
      const cleanImages = propertyData.images
        .filter(img => {
          if (img === null || img === undefined) return false;
          if (typeof img === 'string') {
            return img.trim().length > 0;
          }
          return false; // Only allow strings
        })
        .map(img => String(img).trim());
      
      console.log('[Storage] Processed property images array:', cleanImages);
      
      // Prepare property data with cleaned images
      const finalPropertyData = {
        ...propertyData,
        images: cleanImages
      };
      
      console.log('[Storage] Final property data prepared, creating property...');
      console.log('[Storage] Property data types:', {
        vendorId: typeof finalPropertyData.vendorId,
        images: Array.isArray(finalPropertyData.images),
        imagesLength: finalPropertyData.images.length,
        imagesContent: finalPropertyData.images
      });
      
      // Convert vendorId to ObjectId if needed
      if (finalPropertyData.vendorId) {
        if (mongoose.Types.ObjectId.isValid(finalPropertyData.vendorId)) {
          finalPropertyData.vendorId = typeof finalPropertyData.vendorId === 'string' 
            ? new mongoose.Types.ObjectId(finalPropertyData.vendorId) 
            : finalPropertyData.vendorId;
        } else {
          throw new Error(`Invalid vendorId: ${finalPropertyData.vendorId}`);
        }
      }
      
      // Convert assignedBrokerId to ObjectId if it exists
      if (finalPropertyData.assignedBrokerId) {
        if (mongoose.Types.ObjectId.isValid(finalPropertyData.assignedBrokerId)) {
          finalPropertyData.assignedBrokerId = typeof finalPropertyData.assignedBrokerId === 'string' 
            ? new mongoose.Types.ObjectId(finalPropertyData.assignedBrokerId) 
            : finalPropertyData.assignedBrokerId;
        }
      }
      
      // Add timestamps
      finalPropertyData.createdAt = new Date();
      finalPropertyData.updatedAt = new Date();
      
      // Use insertOne to bypass Mongoose validation (similar to createProject)
      const result = await Property.collection.insertOne(finalPropertyData);
      
      console.log('[Storage] Insert result:', result.insertedId);
      
      // Fetch the created property
      const savedProperty = await Property.findById(result.insertedId);
      if (!savedProperty) {
        throw new Error('Failed to retrieve created property');
      }
      console.log('[Storage] Property saved successfully:', savedProperty._id);
      console.log('[Storage] Property images after save:', savedProperty.images);
      return savedProperty;
    } catch (error) {
      console.error('[Storage] Error in createProperty:', error);
      console.error('[Storage] Error details:', {
        name: error.name,
        message: error.message,
        errors: error.errors,
        code: error.code
      });
      throw error;
    }
  }

  async getProperty(id) {
    return await Property.findById(id).populate('vendorId', 'name email');
  }

  async getAllProperties(filters = {}) {
    return await Property.find(filters).populate('vendorId', 'name email').sort({ createdAt: -1 });
  }

  async getPropertiesByVendor(vendorId) {
    // Convert to ObjectId if it's a string
    let queryId = vendorId;
    if (typeof vendorId === 'string' && mongoose.Types.ObjectId.isValid(vendorId)) {
      queryId = new mongoose.Types.ObjectId(vendorId);
    }
    const properties = await Property.find({ vendorId: queryId }).sort({ createdAt: -1 });
    console.log(`Found ${properties.length} properties for vendor ${vendorId}`);
    return properties;
  }

  async updateProperty(id, updates) {
    return await Property.findByIdAndUpdate(id, { ...updates, updatedAt: Date.now() }, { new: true });
  }

  async deleteProperty(id) {
    return await Property.findByIdAndDelete(id);
  }

  async getPropertiesByPincode(pincode) {
    return await Property.find({ pincode, status: 'active' }).populate('vendorId', 'name email');
  }
}

export const storage = new MongoStorage();
