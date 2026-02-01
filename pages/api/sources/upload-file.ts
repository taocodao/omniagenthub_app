// pages/api/notebooks/sources/upload-file.ts - FIXED FOR v2.3 HIERARCHY + GOOGLE DRIVE TRACKING

import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File as FormidableFile } from 'formidable';
import fs from 'fs';
import path from 'path';
import { createClient } from '@vercel/kv';
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';

const kv = createClient({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// ✅ v2.3 API Configuration
const QUIVR_API_URL = process.env.QUIVR_API_URL || 'http://34.29.195.158';
const QUIVR_API_KEY = process.env.QUIVR_API_KEY || '8f3e9d2a7b6c1e4f5a8d9c2b3e6f7a1b4c5d8e9f2a3b6c7d8e9f1a2b3c4d5e6f';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface NotebookSource {
  id: string;
  title: string;
  type: 'file' | 'website' | 'text';
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  fileSize?: string;
  dateCreated: string;
  fileName?: string;
  selected: boolean;
  quivrDocId?: string;
  fileType?: string;
  content?: string;
  sourceType?: string;          // ✅ NEW: Track source type (google-drive, github, file)
  sourceId?: string;            // ✅ NEW: Original source ID (e.g., Google Drive file ID)
  sourceUrl?: string;           // ✅ NEW: Original source URL
  sourceMetadata?: any;         // ✅ NEW: Additional metadata from source
}

interface Notebook {
  id: string;
  title: string;
  sources: NotebookSource[];
  sourceCount: number;
  created: string;
  lastUpdated: string;
  userAddress: string;
}

interface UploadResponse {
  success: boolean;
  source?: NotebookSource;
  quivrDocId?: string;
  message?: string;
  error?: string;
}

interface QuivrV23UploadResponse {
  status: string;
  doc_id: string;
  chunks: number;
}

// ✅ SUPPORTED FILE TYPES
const SUPPORTED_FILE_TYPES = {
  // Documents
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.rtf': 'application/rtf',
  '.odt': 'application/vnd.oasis.opendocument.text',
  
  // Presentations
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  
  // Spreadsheets
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  
  // Markup & Code
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  
  // Code files
  '.py': 'text/x-python',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.java': 'text/x-java',
  '.cpp': 'text/x-c++',
  '.c': 'text/x-c',
  '.go': 'text/x-go',
  '.rs': 'text/x-rust',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  let file: FormidableFile | undefined;

  try {
    const form = new IncomingForm({
      uploadDir: path.join(process.cwd(), 'tmp'),
      keepExtensions: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
    });

    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const [fields, files] = await form.parse(req);
    file = Array.isArray(files.file) ? files.file[0] : files.file;

    const userKey = Array.isArray(fields.userKey) ? fields.userKey[0] : fields.userKey;
    const sourceId = Array.isArray(fields.sourceId) ? fields.sourceId[0] : fields.sourceId;
    const notebookId = Array.isArray(fields.notebookId) ? fields.notebookId[0] : fields.notebookId;
    const userAddress = Array.isArray(fields.userAddress) ? fields.userAddress[0] : fields.userAddress;
    
    // ✅ NEW: Extract source type and metadata from form fields
    const sourceType = Array.isArray(fields.sourceType) ? fields.sourceType[0] : (fields.sourceType || 'file');
    const originalSourceId = Array.isArray(fields.sourceId) ? fields.sourceId[0] : fields.sourceId;
    
    // ✅ NEW: Parse source metadata if provided
    let sourceMetadataObj: any = {};
    const sourceMetadataField = Array.isArray(fields.sourceMetadata) ? fields.sourceMetadata[0] : fields.sourceMetadata;
    if (sourceMetadataField) {
      try {
        sourceMetadataObj = JSON.parse(sourceMetadataField);
        console.log('📋 [UPLOAD] Source metadata parsed:', sourceMetadataObj);
      } catch (e) {
        console.warn('⚠️ [UPLOAD] Failed to parse sourceMetadata:', e);
      }
    }

    if (!file || !userKey || !sourceId || !notebookId || !userAddress) {
      if (file?.filepath && fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: userKey, sourceId, notebookId, userAddress, file'
      });
      return;
    }

    // ✅ Validate file type
    const fileExt = path.extname(file.originalFilename || '').toLowerCase();
    
    if (!SUPPORTED_FILE_TYPES[fileExt as keyof typeof SUPPORTED_FILE_TYPES]) {
      if (file?.filepath && fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
      
      res.status(400).json({
        success: false,
        error: `Unsupported file type: ${fileExt}. Supported: ${Object.keys(SUPPORTED_FILE_TYPES).join(', ')}`
      });
      return;
    }

    console.log('📁 Processing file upload:', file.originalFilename);
    console.log('   File size:', formatFileSize(file.size));
    console.log('   File type:', fileExt);
    console.log('   Source type:', sourceType); // ✅ NEW
    console.log('   User Address:', userAddress);
    console.log('   Notebook ID:', notebookId);
    console.log('   Source ID:', sourceId);

    // Get notebook from KV
    const notebookKey = `${userKey}:notebook:${notebookId}`;
    const notebookData = await kv.get(notebookKey);

    if (!notebookData) {
      if (file?.filepath && fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
      res.status(404).json({
        success: false,
        error: 'Notebook not found'
      });
      return;
    }

    const notebook: Notebook = typeof notebookData === 'string'
      ? JSON.parse(notebookData)
      : notebookData as Notebook;

    const documentName = file.originalFilename || `document_${Date.now()}`;
    
    console.log('📤 Uploading to Quivr v2.3...');
    console.log(`   Document name: ${documentName}`);
    console.log(`   API URL: ${QUIVR_API_URL}/documents/upload`);
    
    const formData = new FormData();
    const fileStream = fs.createReadStream(file.filepath);
    
    // ✅ Get correct MIME type
    const mimeType = SUPPORTED_FILE_TYPES[fileExt as keyof typeof SUPPORTED_FILE_TYPES] || file.mimetype || 'application/octet-stream';
    
    // ✅ ADD ALL REQUIRED FIELDS FOR v2.3
    formData.append('name', documentName);
    formData.append('user_address', userAddress);  // ✅ REQUIRED
    formData.append('notebook_id', notebookId);    // ✅ REQUIRED
    formData.append('source_id', sourceId);        // ✅ REQUIRED
    formData.append('file', fileStream, {
      filename: file.originalFilename || 'document',
      contentType: mimeType,
    });

    let quivrDocId: string | undefined;
    let uploadSuccess = false;
    let chunksCreated = 0;

    try {
      console.log('🚀 Calling v2.3 /documents/upload endpoint...');
      console.log('   Content-Type:', mimeType);
      console.log('   Hierarchy: user_address → notebook_id → source_id');
      
      const uploadResponse = await axios.post<QuivrV23UploadResponse>(
        `${QUIVR_API_URL}/documents/upload`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'X-API-Key': QUIVR_API_KEY,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 180000, // 3 minutes
        }
      );

      console.log('✅ v2.3 upload response:', JSON.stringify(uploadResponse.data, null, 2));

      if (uploadResponse.data && uploadResponse.data.status === 'success' && uploadResponse.data.doc_id) {
        quivrDocId = uploadResponse.data.doc_id;
        chunksCreated = uploadResponse.data.chunks || 0;
        uploadSuccess = true;
        console.log(`✅ Successfully uploaded to v2.3`);
        console.log(`   doc_id: ${quivrDocId}`);
        console.log(`   chunks: ${chunksCreated}`);
        console.log(`   Hierarchy stored: ${userAddress} → ${notebookId} → ${sourceId}`);
      } else {
        console.warn('⚠️ Unexpected v2.3 response structure:', uploadResponse.data);
        uploadSuccess = false;
      }

    } catch (uploadError) {
      const error = uploadError as AxiosError<any>;
      console.error('❌ Quivr v2.3 upload failed:');
      console.error('   File:', file.originalFilename);
      console.error('   Type:', fileExt);
      console.error('   Status:', error.response?.status);
      console.error('   Status Text:', error.response?.statusText);
      console.error('   Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('   Error Message:', error.message);
      
      if (error.response?.status === 422) {
        console.error('   → Validation failed. Check that user_address, notebook_id, source_id are provided');
        console.error('   → Provided values:');
        console.error(`      user_address: ${userAddress}`);
        console.error(`      notebook_id: ${notebookId}`);
        console.error(`      source_id: ${sourceId}`);
      } else if (error.response?.status === 401) {
        console.error('   → Authentication failed. Check QUIVR_API_KEY');
      } else if (error.response?.status === 400) {
        console.error('   → Bad request. File type may not be supported by backend');
      }
      
      uploadSuccess = false;
      quivrDocId = undefined;
    }

    // Cleanup temp file
    if (file?.filepath && fs.existsSync(file.filepath)) {
      fs.unlinkSync(file.filepath);
      console.log('🗑️  Cleaned up temp file');
    }

    // ✅ NEW: Build source URL based on source type
    let sourceUrl: string | undefined;
    if (sourceType === 'google-drive' && originalSourceId) {
      sourceUrl = `https://drive.google.com/file/d/${originalSourceId}/view`;
    } else if (sourceType === 'github') {
      sourceUrl = sourceMetadataObj?.url || sourceMetadataObj?.htmlUrl;
    }

    // ✅ UPDATED: Create source object with source tracking
    const source: NotebookSource = {
      id: sourceId,
      title: file.originalFilename || 'Unknown File',
      type: 'file',
      status: uploadSuccess ? 'completed' : 'error',
      progress: uploadSuccess ? 100 : 0,
      fileSize: formatFileSize(file.size),
      dateCreated: new Date().toLocaleDateString(),
      fileName: file.originalFilename || undefined,
      selected: true,
      quivrDocId: quivrDocId,
      fileType: fileExt,
      // ✅ NEW: Add source tracking fields
      sourceType: sourceType,
      sourceId: originalSourceId,
      sourceUrl: sourceUrl,
      sourceMetadata: Object.keys(sourceMetadataObj).length > 0 ? sourceMetadataObj : undefined,
    };

    console.log('📝 Source object created:');
    console.log(JSON.stringify(source, null, 2));

    // Update notebook in KV
    const existingSources = notebook.sources || [];
    const existingIndex = existingSources.findIndex((s: NotebookSource) => s.id === sourceId);

    if (existingIndex !== -1) {
      existingSources[existingIndex] = source;
      console.log('📝 Updated existing source in notebook');
    } else {
      existingSources.push(source);
      console.log('📝 Added new source to notebook');
    }

    const updatedNotebook: Notebook = {
      ...notebook,
      sources: existingSources,
      sourceCount: existingSources.length,
      lastUpdated: new Date().toISOString(),
    };

    await kv.set(notebookKey, JSON.stringify(updatedNotebook));
    console.log('✅ Notebook updated in KV storage');

    if (!uploadSuccess || !quivrDocId) {
      console.warn('⚠️ Upload completed but quivrDocId is missing!');
      console.warn('   This will prevent chat from working properly.');
    }

    const message = uploadSuccess && quivrDocId
      ? `File uploaded successfully (${chunksCreated} chunks indexed with hierarchy)${sourceType === 'google-drive' ? ' from Google Drive' : ''}`
      : 'File processed but indexing failed. Please try again.';

    res.status(200).json({
      success: uploadSuccess,
      source,
      quivrDocId,
      message,
    });

  } catch (error) {
    console.error('❌ Upload handler error:', error);
    if (file?.filepath && fs.existsSync(file.filepath)) {
      try {
        fs.unlinkSync(file.filepath);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    });
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
