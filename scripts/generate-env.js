import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateEnvFile() {
  try {
    const { ENV_CONFIG } = await import('../env-config.js');
    
    let envContent = '';
    
    envContent += '# MongoDB Connection\n';
    envContent += `MONGODB_URI=${ENV_CONFIG.MONGODB_URI}\n\n`;
    
    envContent += '# SMTP Configuration\n';
    envContent += `SMTP_HOST=${ENV_CONFIG.SMTP_HOST}\n`;
    envContent += `SMTP_PORT=${ENV_CONFIG.SMTP_PORT}\n`;
    envContent += `SMTP_USER=${ENV_CONFIG.SMTP_USER}\n`;
    envContent += `SMTP_PASSWORD=${ENV_CONFIG.SMTP_PASSWORD}\n`;
    envContent += `SMTP_FROM_EMAIL=${ENV_CONFIG.SMTP_FROM_EMAIL}\n\n`;
    
    envContent += '# Server Configuration\n';
    envContent += `PORT=${ENV_CONFIG.PORT}\n`;
    envContent += `NODE_ENV=${ENV_CONFIG.NODE_ENV}\n`;
    envContent += `SESSION_SECRET=${ENV_CONFIG.SESSION_SECRET}\n\n`;
    
    envContent += '# Optional Configuration\n';
    envContent += `APP_URL=${ENV_CONFIG.APP_URL}\n`;
    envContent += `SUPPORT_EMAIL=${ENV_CONFIG.SUPPORT_EMAIL}\n`;
    envContent += `SUREPASS_API_KEY=${ENV_CONFIG.SUREPASS_API_KEY}\n`;
    envContent += `GOOGLE_CLIENT_ID=${ENV_CONFIG.GOOGLE_CLIENT_ID}\n`;
    envContent += `GOOGLE_CLIENT_SECRET=${ENV_CONFIG.GOOGLE_CLIENT_SECRET}\n`;
    envContent += `GOOGLE_CALLBACK=${ENV_CONFIG.GOOGLE_CALLBACK}\n\n`;
    
    envContent += '# Google Maps API Key (for map display and geocoding)\n';
    envContent += `VITE_GOOGLE_MAPS_API_KEY=${ENV_CONFIG.VITE_GOOGLE_MAPS_API_KEY}\n\n`;
    
    envContent += '# NewsAPI Key\n';
    envContent += `NEWS_API_KEY=${ENV_CONFIG.NEWS_API_KEY}\n`;

    const envPath = path.join(__dirname, '..', '.env');
    fs.writeFileSync(envPath, envContent);
    
    console.log('✓ .env file generated successfully from env-config.js');
  } catch (error) {
    console.error('Error generating .env file:', error.message);
  }
}

generateEnvFile();
