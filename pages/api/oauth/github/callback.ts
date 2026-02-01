// pages/api/oauth/github/callback.ts
import { NextApiRequest, NextApiResponse } from 'next';
// At the top, replace the userTokens line with:


// In-memory storage for demo (use database in production)
const userTokens = new Map<string, any>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.access_token) {
      // Store token for this user/notebook
      const notebookId = state as string;
      userTokens.set(notebookId, tokenData.access_token);
    }

    // Close the popup window
    const html = `
      <html>
        <body>
          <script>
            window.close();
          </script>
          <p>Authorization successful! You can close this window.</p>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).send('Authentication failed');
  }
}
