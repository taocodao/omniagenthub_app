// pages/api/oauth/google-drive/callback.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import { getTokens, setTokens } from '../../../../utils/tokenStorage';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google-drive/callback'
);

// ⚠️ CRITICAL: This needs to be the SAME Map as your main API file
// Consider using a shared module: utils/tokenStorage.ts
const userTokens = new Map<string, any>();

function getTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substr(0, 19);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  console.log(`\n🔄 [${getTimestamp()}] Google Drive OAuth Callback:`);
  console.log(`   🌐 Request URL: ${req.url}`);
  console.log(`   📋 Method: ${req.method}`);
  console.log(`   🔐 Authorization Code: ${code ? 'RECEIVED ✅' : 'MISSING ❌'}`);
  console.log(`   🎯 State (notebookId): ${state || 'MISSING ❌'}`);
  console.log(`   ❌ OAuth Error: ${error || 'NONE ✅'}`);
  console.log(`   🗂️ Current tokens before callback: [${Array.from(userTokens.keys()).join(', ')}]`);
  console.log(`   🎫 Total tokens in memory: ${userTokens.size}`);

  // Check for OAuth errors first
  if (error) {
    console.log(`💥 [CALLBACK] OAuth error received from Google:`);
    console.log(`   🔥 Error: ${error}`);
    console.log(`   📝 This usually means user denied permission or invalid client setup`);
    
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>❌ Authentication Error</h2>
          <p><strong>Error:</strong> ${error}</p>
          <p>Please close this window and try again.</p>
          <p><small>If this persists, check your OAuth app configuration.</small></p>
          <script>
            console.log('OAuth callback error:', '${error}');
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  // Check for missing authorization code
  if (!code) {
    console.log('💥 [CALLBACK] No authorization code received from Google');
    console.log(`   🔍 This means the OAuth flow didn't complete properly`);
    console.log(`   🚫 Expected: ?code=abc123&state=${state}`);
    console.log(`   📋 Received: ${req.url}`);
    
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>❌ Authorization Failed</h2>
          <p>No authorization code received from Google.</p>
          <p>Please close this window and try again.</p>
          <script>
            console.log('OAuth callback missing code');
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `;
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  try {
    console.log('🔄 [CALLBACK] Starting token exchange...');
    console.log(`   🔑 Using Client ID: ${process.env.GOOGLE_CLIENT_ID ? 'SET ✅' : 'MISSING ❌'}`);
    console.log(`   🔐 Using Client Secret: ${process.env.GOOGLE_CLIENT_SECRET ? 'SET ✅' : 'MISSING ❌'}`);
    console.log(`   🔄 Using Redirect URI: ${process.env.GOOGLE_REDIRECT_URI || 'DEFAULT'}`);
    console.log(`   📨 Exchanging code: ${(code as string).substring(0, 20)}...`);
    
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    
    console.log('🎉 [CALLBACK] Token exchange successful!');
    console.log(`   ✅ Tokens received from Google:`);
    console.log(`   🎫 Access Token: ${tokens.access_token ? 'RECEIVED ✅' : 'MISSING ❌'}`);
    console.log(`   🔄 Refresh Token: ${tokens.refresh_token ? 'RECEIVED ✅' : 'MISSING ❌'}`);
    console.log(`   🏷️ Token Type: ${tokens.token_type || 'N/A'}`);
    console.log(`   📍 Scope: ${tokens.scope || 'N/A'}`);
    console.log(`   ⏰ Expires At: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'N/A'}`);
    
    // Store tokens for this user/notebook (use state parameter)
    const notebookId = state as string;
    console.log(`💾 [CALLBACK] Storing tokens for notebook: "${notebookId}"`);
    
    if (!notebookId) {
      console.log('💥 [CALLBACK] No notebook ID in state parameter!');
      throw new Error('Missing notebook ID in OAuth state');
    }
    
    // Store the tokens
   setTokens(notebookId, tokens);
    
    console.log('✅ [CALLBACK] Tokens stored successfully!');
    console.log(`   📊 Total tokens now in memory: ${userTokens.size}`);
    console.log(`   🗂️ All stored notebook IDs: [${Array.from(userTokens.keys()).join(', ')}]`);
    console.log(`   🔍 Can retrieve tokens for "${notebookId}": ${userTokens.has(notebookId) ? 'YES ✅' : 'NO ❌'}`);

    // Test token retrieval immediately
    const storedTokens = getTokens(notebookId);
    console.log(`🧪 [CALLBACK] Token retrieval test:`);
    console.log(`   📋 Retrieved tokens: ${storedTokens ? 'SUCCESS ✅' : 'FAILED ❌'}`);
    console.log(`   🎫 Has access token: ${storedTokens?.access_token ? 'YES ✅' : 'NO ❌'}`);

    // Close the popup window and return to main app
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>✅ Authentication Successful!</h2>
          <p>Google Drive connected successfully.</p>
          <p><strong>Notebook ID:</strong> ${notebookId}</p>
          <p>This window will close automatically...</p>
          <script>
            console.log('OAuth callback completed successfully');
            console.log('Notebook ID:', '${notebookId}');
            console.log('Tokens stored:', ${userTokens.size});
            setTimeout(() => {
              console.log('Closing OAuth popup window');
              window.close();
            }, 1500);
          </script>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    console.log('🚪 [CALLBACK] Sending success page and closing popup');
    return res.send(html);
    
  } catch (error: any) {
    console.error(`💥 [CALLBACK] Token exchange failed:`);
    console.error(`   🔥 Error Message: ${error.message}`);
    console.error(`   📚 Error Name: ${error.name}`);
    console.error(`   🔍 Error Code: ${error.code || 'N/A'}`);
    
    if (error.response) {
      console.error(`   🌐 HTTP Status: ${error.response.status}`);
      console.error(`   📄 Response Data:`, error.response.data);
      console.error(`   📋 Response Headers:`, error.response.headers);
    }
    
    if (error.stack) {
      console.error(`   📍 Stack Trace:`);
      console.error(error.stack);
    }
    
    // Additional debugging info
    console.error(`   🔍 Debug Info:`);
    console.error(`     - Code received: ${code ? 'YES' : 'NO'}`);
    console.error(`     - State received: ${state ? 'YES' : 'NO'}`);
    console.error(`     - Client ID set: ${process.env.GOOGLE_CLIENT_ID ? 'YES' : 'NO'}`);
    console.error(`     - Client Secret set: ${process.env.GOOGLE_CLIENT_SECRET ? 'YES' : 'NO'}`);
    
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>❌ Authentication Failed</h2>
          <p><strong>Error:</strong> ${error.message}</p>
          <p>Please close this window and try again.</p>
          <details style="text-align: left; margin-top: 20px;">
            <summary>Technical Details</summary>
            <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
Error: ${error.name}
Message: ${error.message}
Code: ${error.code || 'N/A'}
            </pre>
          </details>
          <script>
            console.error('OAuth callback failed:', '${error.message}');
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }
}
