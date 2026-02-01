// pages/api/sources/scrape-website.ts - FIXED VERSION
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import * as cheerio from 'cheerio';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface NotebookSource {
  id: string;
  title: string;
  type: 'file' | 'website' | 'text';
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  fileSize?: string;
  dateCreated: string;
  error?: string;
  url?: string;
  fileName?: string;
  content?: string;
  selected: boolean;
  quivrDocId?: string;
  fileType?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { userKey, sourceId, notebookId, url, userAddress } = req.body;

    if (!userKey || !sourceId || !notebookId || !url || !userAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: userKey, sourceId, notebookId, url, userAddress' 
      });
    }

    console.log('🌐 [Website Scrape] Processing:', url);
    console.log('   User:', userAddress.substring(0, 10) + '...');
    console.log('   Notebook:', notebookId);
    console.log('   Source ID:', sourceId);

    // ✅ STEP 1: Validate URL
    let validUrl: URL;
    try {
      validUrl = new URL(url);
      if (!['http:', 'https:'].includes(validUrl.protocol)) {
        throw new Error('Only HTTP/HTTPS URLs are supported');
      }
    } catch (urlError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL provided. Please enter a valid HTTP/HTTPS URL.'
      });
    }

    // ✅ STEP 2: Scrape website content
    let scrapedContent = '';
    let title = '';
    let contentLength = 0;
    
    try {
      console.log('📄 [Website Scrape] Fetching content...');
      
      const scrapeResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!scrapeResponse.ok) {
        throw new Error(`HTTP ${scrapeResponse.status}: ${scrapeResponse.statusText}`);
      }

      const html = await scrapeResponse.text();
      const $ = cheerio.load(html);
      
      // Remove unwanted elements
      $('script, style, noscript, iframe, nav, footer, header, aside, .ad, .advertisement').remove();
      
      // Extract title
      title = $('title').text().trim() || 
              $('h1').first().text().trim() || 
              validUrl.hostname;
      
      // Extract main content
      const mainContent = $('main, article, [role="main"], .content, .main-content, body')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      
      scrapedContent = mainContent.substring(0, 100000);
      contentLength = scrapedContent.length;

      if (!scrapedContent || scrapedContent.length < 50) {
        throw new Error('Could not extract sufficient content from the website');
      }

      console.log('✅ [Website Scrape] Content extracted:', contentLength, 'chars');
      
    } catch (scrapeError: any) {
      console.error('❌ [Website Scrape] Failed:', scrapeError.message);
      
      const errorSource: NotebookSource = {
        id: sourceId,
        title: validUrl.hostname,
        type: 'website',
        status: 'error',
        progress: 0,
        dateCreated: new Date().toLocaleDateString(),
        url: url,
        selected: false,
        error: scrapeError.message || 'Failed to scrape website content',
      };
      
      await addSourceToNotebook(userKey, notebookId, errorSource);
      
      return res.status(500).json({
        success: false,
        error: `Failed to scrape website: ${scrapeError.message}`,
        source: errorSource
      });
    }

    // ✅ STEP 3: Upload to Quivr RAG API v2.4
    let quivrDocId = null;
    const QUIVR_API_URL = process.env.NEXT_PUBLIC_QUIVR_API_URL || 'http://34.29.195.158';
    const API_KEY = process.env.QUIVR_API_KEY || '8f3e9d2a7b6c1e4f5a8d9c2b3e6f7a1b4c5d8e9f2a3b6c7d8e9f1a2b3c4d5e6f';
    
    try {
      console.log('📤 [Quivr Upload] Uploading to Quivr RAG API...');
      console.log('   API URL:', QUIVR_API_URL);
      console.log('   Source ID:', sourceId);

      // ✅ CRITICAL FIX: Create proper FormData
      const formData = new FormData();
      
      // Create blob from content
      const contentBlob = new Blob([scrapedContent], { type: 'text/plain; charset=utf-8' });
      const fileName = `${title.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50)}.txt`;
      
      // Append all required fields
      formData.append('file', contentBlob, fileName);
      formData.append('name', title);
      formData.append('user_address', userAddress);
      formData.append('notebook_id', notebookId);
      formData.append('source_id', sourceId);  // ✅ MUST match frontend ID

      console.log('📋 [Quivr Upload] Form data prepared:');
      console.log('   - file:', fileName, contentBlob.size, 'bytes');
      console.log('   - name:', title);
      console.log('   - user_address:', userAddress);
      console.log('   - notebook_id:', notebookId);
      console.log('   - source_id:', sourceId);

      const uploadResponse = await fetch(`${QUIVR_API_URL}/documents/upload`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          // DO NOT SET Content-Type - let browser set it with boundary
        },
        body: formData,
      });

      const responseText = await uploadResponse.text();
      console.log('📥 [Quivr Upload] Response status:', uploadResponse.status);
      console.log('📥 [Quivr Upload] Response body:', responseText);

      if (uploadResponse.ok) {
        const uploadResult = JSON.parse(responseText);
        quivrDocId = uploadResult.doc_id;
        console.log('✅ [Quivr Upload] SUCCESS!');
        console.log('   Doc ID:', quivrDocId);
        console.log('   Chunks:', uploadResult.chunks);
      } else {
        console.error(`❌ [Quivr Upload] Failed (${uploadResponse.status}):`, responseText);
        throw new Error(`Quivr upload failed: ${responseText}`);
      }
      
    } catch (quivrError: any) {
      console.error('❌ [Quivr Upload] Error:', quivrError.message);
      
      // Still create source in KV but mark as error
      const errorSource: NotebookSource = {
        id: sourceId,
        title: title,
        type: 'website',
        status: 'error',
        progress: 0,
        dateCreated: new Date().toLocaleDateString(),
        url: url,
        fileName: title,
        fileSize: `${(contentLength / 1024).toFixed(1)} KB`,
        content: scrapedContent.substring(0, 10000),
        selected: false,
        error: `Quivr upload failed: ${quivrError.message}`,
        fileType: 'website'
      };
      
      await addSourceToNotebook(userKey, notebookId, errorSource);
      
      return res.status(500).json({
        success: false,
        error: `Quivr upload failed: ${quivrError.message}`,
        source: errorSource
      });
    }

    // ✅ STEP 4: Create source object
    const source: NotebookSource = {
      id: sourceId,
      title: title,
      type: 'website',
      status: 'completed',
      progress: 100,
      dateCreated: new Date().toLocaleDateString(),
      url: url,
      fileName: title,
      fileSize: `${(contentLength / 1024).toFixed(1)} KB`,
      content: scrapedContent.substring(0, 10000),
      selected: true,
      quivrDocId: quivrDocId,
      fileType: 'website'
    };

    // ✅ STEP 5: Save source to notebook
    await addSourceToNotebook(userKey, notebookId, source);

    console.log('✅ [Website Scrape] Complete! Source ID:', sourceId);

    res.status(200).json({
      success: true,
      source: source,
      quivrDocId: quivrDocId,
      message: 'Website scraped and added successfully',
      contentLength: contentLength
    });

  } catch (error: any) {
    console.error('❌ [Website Scrape] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to scrape website'
    });
  }
}

async function addSourceToNotebook(
  userKey: string, 
  notebookId: string, 
  source: NotebookSource
): Promise<void> {
  try {
    const sourcesKey = `${userKey}:notebook:${notebookId}:sources`;
    const sourcesData = await kv.get(sourcesKey);

    let sourcesList: NotebookSource[] = [];
    if (sourcesData && typeof sourcesData === 'string') {
      try {
        sourcesList = JSON.parse(sourcesData);
      } catch (e) {
        sourcesList = [];
      }
    }

    const existingIndex = sourcesList.findIndex(s => s.id === source.id);
    if (existingIndex !== -1) {
      sourcesList[existingIndex] = source;
    } else {
      sourcesList.push(source);
    }

    await kv.set(sourcesKey, JSON.stringify(sourcesList));

    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (notebookData && typeof notebookData === 'string') {
      const notebook = JSON.parse(notebookData);
      notebook.sourceCount = sourcesList.length;
      notebook.sources = sourcesList;
      notebook.lastUpdated = new Date().toISOString();
      await kv.set(notebookKey, JSON.stringify(notebook));
    }

  } catch (error: any) {
    console.error('❌ Error saving source to notebook:', error);
    throw new Error(`Failed to save source: ${error.message}`);
  }
}
