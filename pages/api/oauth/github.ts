// pages/api/oauth/github.ts
import { NextApiRequest, NextApiResponse } from 'next';

// In-memory storage for demo (use database in production)
const userTokens = new Map<string, any>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { action, notebookId, owner, repo, path = '' } = req.query;

  try {
    switch (action) {
      case 'authorize':
        // Generate GitHub OAuth URL
        const clientId = process.env.GITHUB_CLIENT_ID;
        const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/oauth/github/callback';
        
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo&state=${notebookId}`;

        return res.json({ success: true, authUrl });

      case 'repositories':
        // Get user's stored tokens
        const accessToken = userTokens.get(notebookId as string);
        if (!accessToken) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        // Fetch user's repositories
        const reposResponse = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!reposResponse.ok) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        const repositories = await reposResponse.json();
        return res.json(repositories.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          html_url: repo.html_url,
          default_branch: repo.default_branch,
        })));

      case 'contents':
        const token = userTokens.get(notebookId as string);
        if (!token) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        // Fetch repository contents
        const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const contentsResponse = await fetch(contentsUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });

        if (!contentsResponse.ok) {
          return res.status(contentsResponse.status).json({ error: 'Failed to fetch contents' });
        }

        const contents = await contentsResponse.json();
        const items = Array.isArray(contents) ? contents : [contents];

        // ✅ FIXED: Handle path as string or string[] properly
        const pathString = Array.isArray(path) ? path[0] : path;
        const parentPath = pathString ? pathString.split('/').slice(0, -1).join('/') : '';

        return res.json({
          items: items.map((item: any) => ({
            path: item.path,
            name: item.name,
            type: item.type, // 'file' or 'dir'
            mode: item.mode,
            sha: item.sha,
            size: item.size,
            url: item.url,
          })),
          parentPath,
        });

      case 'add-source':
        if (req.method !== 'POST') {
          return res.status(405).json({ error: 'Method not allowed' });
        }

        const { paths } = req.body;
        // Here you would save the selected files to the user's notebook
        
        return res.json({ success: true, message: `Added ${paths.length} files to notebook` });

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('GitHub API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
