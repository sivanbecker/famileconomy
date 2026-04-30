# Google OAuth Setup Guide for Famileconomy

This guide walks you through creating a Google Cloud project and obtaining OAuth credentials needed for the Google Drive batch import feature.

## Prerequisites

- A Google account (personal or Google Workspace)
- Access to Google Cloud Console (https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **"NEW PROJECT"**
4. Enter project name: `famileconomy` (or your preferred name)
5. Click **"CREATE"**
6. Wait for the project to be created (this may take a minute)

## Step 2: Enable the Google Drive API

1. In the Cloud Console, navigate to **APIs & Services** > **Library**
2. Search for **"Google Drive API"**
3. Click on **"Google Drive API"** in the results
4. Click **"ENABLE"**
5. Wait for the API to be enabled

## Step 3: Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. You'll see a prompt: **"To create an OAuth client ID, you must first create an OAuth consent screen"**
   - Click **"CREATE CONSENT SCREEN"**

## Step 4: Configure the OAuth Consent Screen

1. Choose **"External"** for User Type (this allows you to test with your own account)
2. Click **"CREATE"**
3. Fill in the form:
   - **App name:** `Famileconomy`
   - **User support email:** Your email address
   - **Developer contact information:** Your email address
4. Scroll to the bottom and click **"SAVE AND CONTINUE"**
5. On the **"Scopes"** page, click **"SAVE AND CONTINUE"** (no additional scopes needed now)
6. On the **"Test users"** page:
   - Click **"ADD USERS"**
   - Enter your Google account email address
   - Click **"ADD"**
7. Review the summary and click **"BACK TO DASHBOARD"**

## Step 5: Create OAuth Client Credentials

1. Navigate to **APIs & Services** > **Credentials** again
2. Click **"+ CREATE CREDENTIALS"** > **"OAuth client ID"**
3. Select **"Web application"** as the application type
4. Fill in the details:
   - **Name:** `Famileconomy Web`
   - **Authorized JavaScript origins:**
     - `http://localhost:3001` (for local development)
     - `http://localhost:3000` (for frontend local dev)
   - **Authorized redirect URIs:**
     - `http://localhost:3001/auth/google/callback` (for local development)
     - If deploying to production, add: `https://api.yourdomain.com/auth/google/callback`
5. Click **"CREATE"**
6. A modal will appear with your credentials:
   - **Client ID** (copy this)
   - **Client Secret** (copy this)
7. Click **"DOWNLOAD JSON"** to save a backup

## Step 6: Add Credentials to Your Environment

### Local Development

Create or update `.env.local` in `apps/api/`:

```env
# Google OAuth
GOOGLE_CLIENT_ID=<your-client-id-from-step-5>
GOOGLE_CLIENT_SECRET=<your-client-secret-from-step-5>
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
GOOGLE_OAUTH_SUCCESS_REDIRECT=http://localhost:3000/dashboard?googleConnected=true
GOOGLE_OAUTH_FAILURE_REDIRECT=http://localhost:3000/dashboard?googleConnected=false
```

### Production (Railway)

1. Go to your Railway dashboard
2. Select the Famileconomy API service
3. Open **Variables**
4. Add the same environment variables:
   ```
   GOOGLE_CLIENT_ID=<client-id>
   GOOGLE_CLIENT_SECRET=<client-secret>
   GOOGLE_REDIRECT_URI=https://api.yourdomain.com/auth/google/callback
   GOOGLE_OAUTH_SUCCESS_REDIRECT=https://yourdomain.com/dashboard?googleConnected=true
   GOOGLE_OAUTH_FAILURE_REDIRECT=https://yourdomain.com/dashboard?googleConnected=false
   ```

## Step 7: Update Authorized Redirect URIs for Production

When you deploy to production:

1. Go back to Google Cloud Console > **APIs & Services** > **Credentials**
2. Click on your OAuth 2.0 Client ID to edit it
3. Add your production redirect URI to **"Authorized redirect URIs"**:
   - `https://api.yourdomain.com/auth/google/callback`
4. Click **"SAVE"**

## Step 8: Test the OAuth Flow (Local)

1. Start the API server: `npm run dev --workspace @famileconomy/api`
2. Start the web app: `npm run dev --workspace @famileconomy/web`
3. Navigate to http://localhost:3000/dashboard
4. Click **"חבר את Google Drive"** (Connect Google Drive)
5. You'll be redirected to Google's consent screen
6. Click **"Continue"** to authorize Famileconomy to access your Drive
7. You'll be redirected back with `googleConnected=true` in the URL

## Troubleshooting

### "Redirect URI mismatch" Error

- **Cause:** The redirect URI in your .env doesn't match what's configured in Google Cloud Console
- **Fix:** Double-check both values are identical (including http/https, hostname, and port)

### "Invalid client_id" Error

- **Cause:** Incorrect `GOOGLE_CLIENT_ID` in .env
- **Fix:** Copy the Client ID again from Google Cloud Console, verify no extra spaces

### "Client secret expired" / "Invalid request"

- **Cause:** Client secret may have been regenerated or the API isn't enabled
- **Fix:**
  1. Verify the Google Drive API is enabled in Cloud Console
  2. Generate a new OAuth client ID if needed

### Consent screen shows "This app isn't verified"

- **This is normal** for apps in development with "External" user type
- Click **"Continue"** to proceed
- Once you move to production, you can submit for verification (optional)

## Security Notes

- **Never commit** `.env.local` or your credentials to Git (already in `.gitignore`)
- **Rotate credentials regularly** in production
- Keep your Client Secret safe — treat it like a password
- Use **restricted API keys** in production (IP restrictions, HTTP referrer restrictions)
- For production, consider using a service account instead of OAuth for server-to-server API calls

## References

- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Drive API Documentation](https://developers.google.com/drive)
- [OAuth 2.0 Setup Guide](https://developers.google.com/identity/protocols/oauth2)
