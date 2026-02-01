// pages/api/sources/upload-youtube.ts
// ═══════════════════════════════════════════════════════════════════════════
// Quivr v2.4 YouTube Upload - Uses Native Backend Endpoint
// ═══════════════════════════════════════════════════════════════════════════

import type { NextApiRequest, NextApiResponse } from 'next';

interface UploadYoutubeRequest {
  userKey: string;
  sourceId: string;
  notebookId: string;
  youtubeUrl: string;
  userAddress: string;
  videoTitle?: string;
}

interface UploadYoutubeResponse {
  success: boolean;
  quivrDocId?: string;
  videoId?: string;
  videoTitle?: string;
  sourceId?: string;
  transcriptLength?: number;
  chunks?: number;
  youtubeUrl?: string;
  message?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadYoutubeResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    const {
      userKey,
      sourceId,
      notebookId,
      youtubeUrl,
      userAddress,
      videoTitle
    } = req.body as UploadYoutubeRequest;

    // Logging
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📹 [YouTube Upload] Request received');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('👤 User:', userAddress?.substring(0, 10) + '...');
    console.log('📓 Notebook:', notebookId);
    console.log('📦 Source ID:', sourceId);
    console.log('🔗 URL:', youtubeUrl);
    console.log('═══════════════════════════════════════════════════════════════');

    // Validate required fields
    if (!userKey || !sourceId || !notebookId || !youtubeUrl || !userAddress) {
      console.error('❌ [YouTube Upload] Missing required parameters');
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: userKey, sourceId, notebookId, youtubeUrl, userAddress'
      });
    }

    // Validate YouTube URL format
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(youtubeUrl)) {
      console.error('❌ [YouTube Upload] Invalid YouTube URL format');
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.'
      });
    }

    // Get Quivr API configuration
    const QUIVR_API_URL = process.env.NEXT_PUBLIC_QUIVR_API_URL || 'http://34.29.195.158';
    const API_KEY = process.env.QUIVR_API_KEY;

    if (!API_KEY) {
      console.error('❌ [YouTube Upload] QUIVR_API_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: API key not found'
      });
    }

    console.log('📡 [YouTube Upload] Sending to Quivr backend...');
    console.log('🔗 Endpoint:', `${QUIVR_API_URL}/youtube/upload`);

    // Prepare FormData for Quivr's native YouTube endpoint
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('youtube_url', youtubeUrl);
    formData.append('user_address', userAddress);
    formData.append('notebook_id', notebookId);
    formData.append('source_id', sourceId);
    
    // Add optional video title if provided
    if (videoTitle) {
      formData.append('name', videoTitle);
    }

    // Call Quivr's native /youtube/upload endpoint
    const uploadResponse = await fetch(`${QUIVR_API_URL}/youtube/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        ...formData.getHeaders(),
      },
      body: formData.getBuffer(),
    });

    const responseText = await uploadResponse.text();
    console.log('📬 [YouTube Upload] Response status:', uploadResponse.status);

    // Parse response
    let uploadResult: any;
    try {
      uploadResult = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ [YouTube Upload] Failed to parse response:', responseText.substring(0, 500));
      return res.status(500).json({
        success: false,
        error: `Invalid response from Quivr: ${responseText.substring(0, 200)}`
      });
    }

    // Handle success
    if (uploadResponse.ok && uploadResult.success) {
      console.log('✅ [YouTube Upload] Success!');
      console.log('📄 Document ID:', uploadResult.doc_id);
      console.log('🎬 Video ID:', uploadResult.video_id);
      console.log('📝 Title:', uploadResult.video_title);
      console.log('📊 Transcript:', uploadResult.transcript_length, 'characters');
      console.log('🧩 Chunks:', uploadResult.chunks);
      console.log('═══════════════════════════════════════════════════════════════');

      return res.status(200).json({
        success: true,
        quivrDocId: uploadResult.doc_id,
        videoId: uploadResult.video_id,
        videoTitle: uploadResult.video_title,
        sourceId: uploadResult.source_id,
        transcriptLength: uploadResult.transcript_length,
        chunks: uploadResult.chunks,
        youtubeUrl: uploadResult.youtube_url,
        message: 'YouTube video transcript uploaded successfully via Quivr backend'
      });
    }

    // Handle known error responses
    if (uploadResult.detail) {
      const errorMessage = typeof uploadResult.detail === 'string' 
        ? uploadResult.detail 
        : JSON.stringify(uploadResult.detail);
      
      console.error('❌ [YouTube Upload] Quivr error:', errorMessage);
      
      // Map common errors to user-friendly messages
      if (errorMessage.includes('transcript')) {
        return res.status(400).json({
          success: false,
          error: 'No transcript available for this video. Please ensure the video has captions/subtitles enabled.'
        });
      }
      
      if (errorMessage.includes('Invalid YouTube URL')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid YouTube URL. Please check the link and try again.'
        });
      }

      return res.status(uploadResponse.status).json({
        success: false,
        error: errorMessage
      });
    }

    // Handle unexpected errors
    console.error('❌ [YouTube Upload] Unexpected error:', responseText.substring(0, 500));
    return res.status(uploadResponse.status || 500).json({
      success: false,
      error: `Upload failed: ${responseText.substring(0, 200)}`
    });

  } catch (error: any) {
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('❌ [YouTube Upload] Fatal error:', error.message);
    console.error('Stack:', error.stack?.substring(0, 500));
    console.error('═══════════════════════════════════════════════════════════════');
    
    return res.status(500).json({
      success: false,
      error: `Server error: ${error.message || 'Failed to process YouTube video'}`
    });
  }
}
