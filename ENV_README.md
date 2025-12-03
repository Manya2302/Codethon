# Environment Variables Management

This project uses an automatic .env file generation system. All environment variables are stored in `env-config.js` and automatically generate the `.env` file when needed.

## How It Works

1. **Configuration Source**: All environment variables are defined in `env-config.js`
2. **Auto-Generation**: When you run the project, if `.env` doesn't exist, it's automatically created from `env-config.js`
3. **Git Tracking**: The `.env` file is now tracked in git (removed from .gitignore)

## Files Involved

- `env-config.js` - Main configuration file containing all environment variables
- `scripts/generate-env.js` - Script that generates .env from env-config.js
- `.env` - Auto-generated file (created from env-config.js)

## Usage

### Running the Project
Simply run the project as normal:
```bash
npm run dev
```

The .env file will be automatically generated if it doesn't exist.

### Manually Regenerate .env
If you need to regenerate the .env file manually:
```bash
npm run generate-env
```

### Updating Environment Variables

To add or modify environment variables:

1. Edit `env-config.js` with your new values
2. Run `npm run generate-env` to update the .env file
3. Restart your server

Example:
```javascript
// env-config.js
export const ENV_CONFIG = {
  NEW_API_KEY: 'your-new-api-key',
  // ... other variables
};
```

## Current Environment Variables

### MongoDB
- `MONGODB_URI` - MongoDB connection string

### SMTP (Email)
- `SMTP_HOST` - SMTP server host
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASSWORD` - SMTP password
- `SMTP_FROM_EMAIL` - Email sender address

### Server
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `SESSION_SECRET` - Session secret key

### Optional
- `APP_URL` - Application URL
- `SUPPORT_EMAIL` - Support email address
- `SUREPASS_API_KEY` - Surepass API key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_CALLBACK` - Google OAuth callback URL
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps API key

## Benefits

✅ **No Manual .env Management**: Just edit env-config.js and regenerate
✅ **Version Controlled**: Environment variables are tracked in git
✅ **Automatic Setup**: New developers just need to clone and run
✅ **Single Source of Truth**: All config in one place (env-config.js)

## Important Notes

⚠️ **Security**: Since .env is now tracked in git, be careful about:
- Not committing sensitive production credentials
- Using different values for development vs production
- Consider using Replit Secrets for production deployments

💡 **Tip**: For production deployments, you may want to use Replit's environment variables or secrets management instead of committing sensitive values to git.
