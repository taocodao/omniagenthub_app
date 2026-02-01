// notebooklm-mcp-server.js
/**
 * Standalone MCP Server for NotebookLM automation
 * This runs as a separate process and communicates via stdin/stdout
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

class NotebookLMAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: process.env.NODE_ENV === 'production',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      this.page = await this.browser.newPage();

      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      console.log(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
      return true;
    } catch (error) {
      console.error(JSON.stringify({ type: 'error', error: error.message }));
      return false;
    }
  }

  async authenticate(tokens) {
    try {
      await this.page.goto('https://notebooklm.google.com', { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Inject Google auth tokens if needed
      if (tokens.access_token) {
        await this.page.evaluateOnNewDocument((accessToken) => {
          localStorage.setItem('google_access_token', accessToken);
        }, tokens.access_token);
      }

      // Wait for login or check if already authenticated
      try {
        await this.page.waitForSelector('[data-testid="notebook-card"], .sign-in-button', { 
          timeout: 15000 
        });

        // Check if we see notebook cards (authenticated) or sign-in button
        const isSignedIn = await this.page.$('[data-testid="notebook-card"]') !== null;

        if (!isSignedIn) {
          throw new Error('Not authenticated - please login manually first');
        }

        this.isAuthenticated = true;
        console.log(JSON.stringify({ type: 'authenticated', timestamp: Date.now() }));
        return true;

      } catch (timeoutError) {
        throw new Error('Authentication timeout - page did not load properly');
      }

    } catch (error) {
      console.log(JSON.stringify({ type: 'auth_error', error: error.message }));
      return false;
    }
  }

  async getNotebooks() {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // Navigate to notebooks page if not already there
      await this.page.goto('https://notebooklm.google.com', { 
        waitUntil: 'networkidle2' 
      });

      // Wait for notebooks to load
      await this.page.waitForSelector('[data-testid="notebook-card"], .empty-state', { 
        timeout: 10000 
      });

      // Extract notebook information
      const notebooks = await this.page.evaluate(() => {
        const notebookCards = document.querySelectorAll('[data-testid="notebook-card"]');
        const notebooks = [];

        notebookCards.forEach((card, index) => {
          const titleElement = card.querySelector('h3, .notebook-title, [class*="title"]');
          const metaElement = card.querySelector('.notebook-meta, [class*="meta"], .subtitle');
          const linkElement = card.querySelector('a') || card;

          const title = titleElement ? 
            titleElement.textContent.trim() : 
            `Notebook ${index + 1}`;

          const href = linkElement.href || '';
          const notebookId = href.includes('/notebook/') ? 
            href.split('/notebook/')[1].split('?')[0] : 
            `notebook_${index}`;

          // Extract source count and last modified from meta text
          const metaText = metaElement ? metaElement.textContent : '';
          const sourceMatch = metaText.match(/(\d+)\s+sources?/i);
          const sourceCount = sourceMatch ? parseInt(sourceMatch[1]) : 0;

          notebooks.push({
            id: notebookId,
            title: title,
            sourceCount: sourceCount,
            lastModified: new Date().toISOString().split('T')[0], // Fallback date
            url: href
          });
        });

        return notebooks;
      });

      console.log(JSON.stringify({ type: 'notebooks', notebooks: notebooks }));
      return notebooks;

    } catch (error) {
      console.log(JSON.stringify({ type: 'error', error: error.message }));
      throw error;
    }
  }

  async extractNotebookContent(notebookId) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    try {
      // Navigate to specific notebook
      const notebookUrl = `https://notebooklm.google.com/notebook/${notebookId}`;
      await this.page.goto(notebookUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for content to load
      await this.page.waitForSelector('.source-list, .sources, [data-testid="source"]', { 
        timeout: 15000 
      });

      // Extract all source content
      const content = await this.page.evaluate(() => {
        const sources = [];

        // Try multiple selectors for sources
        const sourceSelectors = [
          '[data-testid="source"]',
          '.source-item',
          '.source-card',
          '.source'
        ];

        let sourceElements = [];
        for (const selector of sourceSelectors) {
          sourceElements = document.querySelectorAll(selector);
          if (sourceElements.length > 0) break;
        }

        sourceElements.forEach((source, index) => {
          const titleEl = source.querySelector('h3, h4, .title, .source-title');
          const contentEl = source.querySelector('.content, .source-content, .text, p');

          const title = titleEl ? titleEl.textContent.trim() : `Source ${index + 1}`;
          const content = contentEl ? contentEl.textContent.trim() : 
                          source.textContent.trim().substring(0, 1000); // Fallback to full text

          if (content && content.length > 10) {
            sources.push({
              content: content,
              source: title,
              type: 'text',
              index: index
            });
          }
        });

        // If no sources found via source elements, try to get general content
        if (sources.length === 0) {
          const contentAreas = document.querySelectorAll('.chat-content, .notebook-content, main p');
          contentAreas.forEach((area, index) => {
            const text = area.textContent.trim();
            if (text && text.length > 20) {
              sources.push({
                content: text,
                source: `Content ${index + 1}`,
                type: 'text',
                index: index
              });
            }
          });
        }

        return sources;
      });

      console.log(JSON.stringify({ 
        type: 'content', 
        content: content,
        count: content.length 
      }));

      return content;

    } catch (error) {
      console.log(JSON.stringify({ type: 'error', error: error.message }));
      throw error;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main process
const automation = new NotebookLMAutomation();

process.stdin.on('data', async (data) => {
  try {
    const command = JSON.parse(data.toString().trim());

    switch (command.command) {
      case 'authenticate':
        await automation.authenticate(command.tokens);
        break;

      case 'list_notebooks':
        await automation.getNotebooks();
        break;

      case 'extract_content':
        await automation.extractNotebookContent(command.notebookId);
        break;

      default:
        console.log(JSON.stringify({ 
          type: 'error', 
          error: `Unknown command: ${command.command}` 
        }));
    }
  } catch (error) {
    console.log(JSON.stringify({ 
      type: 'error', 
      error: error.message 
    }));
  }
});

// Initialize on startup
automation.initialize().catch(error => {
  console.log(JSON.stringify({ 
    type: 'error', 
    error: `Initialization failed: ${error.message}` 
  }));
  process.exit(1);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  await automation.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await automation.cleanup();
  process.exit(0);
});
