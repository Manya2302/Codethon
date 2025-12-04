export const ENV_CONFIG = {
  // MongoDB Connection
  MONGODB_URI: process.env.MONGODB_URI || '',

  // SMTP Configuration
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: process.env.SMTP_PORT || '587',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_FROM_EMAIL: process.env.SMTP_FROM_EMAIL || '',

  // Server Configuration
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',

  // Optional Configuration
  APP_URL: process.env.APP_URL || process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000',
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@terrismart.com',
  SUREPASS_API_KEY: process.env.SUREPASS_API_KEY || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK: process.env.GOOGLE_CALLBACK || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback` : 'http://localhost:5000/api/auth/google/callback'),

  // Google Maps API Key (for map display and geocoding)
  VITE_GOOGLE_MAPS_API_KEY: process.env.VITE_GOOGLE_MAPS_API_KEY || '',

  // NewsAPI Key
  NEWS_API_KEY: process.env.NEWS_API_KEY || ''
};
