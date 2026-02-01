// pages/api/oauth/google-drive.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { getTokens } from '../../../utils/tokenStorage';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google-drive/callback'
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Get action from query, but notebookId can come from either query or body
  const { action, folderId = 'root' } = req.query as {
    action: string;
    folderId?: string;
  };

  // For POST requests, get notebookId from body; for GET, from query
  const notebookId = req.method === 'POST' 
    ? (req.body?.notebookId as string)
    : (req.query.notebookId as string);

  console.log('🔍 [GOOGLE-DRIVE] API Called:', { action, notebookId, folderId });

  try {
    // Authorization flow
    if (action === 'authorize') {
      if (!notebookId) {
        console.error('❌ [AUTHORIZE] No notebookId provided');
        return res.status(400).json({ error: 'NotebookId is required' });
      }

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        state: notebookId,
        // prompt: 'consent', // Force consent to always get refresh token
      });
      
      console.log('✅ [AUTHORIZE] Generated auth URL for notebook:', notebookId);
      return res.json({ success: true, authUrl });
    }

    // List folders and files
    if (action === 'folders') {
      if (!notebookId) {
        console.error('❌ [FOLDERS] No notebookId provided');
        return res.status(400).json({ error: 'NotebookId is required' });
      }

      const tokens = getTokens(notebookId);
      if (!tokens) {
        console.error('❌ [FOLDERS] No tokens found for notebook:', notebookId);
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log('✅ [FOLDERS] Found tokens for notebook:', notebookId);
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
      });

      // Separate folders and files
      const items = response.data.files || [];
      const folders = items
        .filter(f => f.mimeType === 'application/vnd.google-apps.folder')
        .map(f => ({ ...f, isFolder: true }));
      const files = items
        .filter(f => f.mimeType !== 'application/vnd.google-apps.folder')
        .map(f => ({ ...f, isFolder: false }));

      console.log(`✅ [FOLDERS] Retrieved ${folders.length} folders, ${files.length} files`);

      return res.json({
        folders,
        files,
        parentId: folderId === 'root' ? '' : folderId,
        currentPath: folderId === 'root' ? '' : folderId
      });
    }

    // Add source from Google Drive
    if (action === 'add-source') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      
      if (!notebookId) {
        console.error('❌ [ADD-SOURCE] No notebookId provided');
        return res.status(400).json({ error: 'NotebookId is required' });
      }

      const { fileIds } = req.body as { fileIds: string[] };
      
      if (!fileIds || fileIds.length === 0) {
        console.error('❌ [ADD-SOURCE] No fileIds provided');
        return res.status(400).json({ error: 'FileIds are required' });
      }

      const tokens = getTokens(notebookId);
      if (!tokens) {
        console.error('❌ [ADD-SOURCE] No tokens found for notebook:', notebookId);
        return res.status(401).json({ error: 'Not authenticated' });
      }

      console.log('✅ [ADD-SOURCE] Found tokens, processing', fileIds.length, 'files');
      oauth2Client.setCredentials(tokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      // Construct the base URL using NEXT_PUBLIC_CONFIG_ENV
      const isDev = process.env.NEXT_PUBLIC_CONFIG_ENV === 'dev';
      const protocol = isDev ? 'http' : 'https';
      const host = req.headers.host || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;

      console.log(`🌐 [ADD-SOURCE] Using base URL: ${baseUrl} (env: ${process.env.NEXT_PUBLIC_CONFIG_ENV})`);

      // Get user credentials from request headers
      const userKey = req.headers['x-user-key'] as string;
      const userAddress = req.headers['x-user-address'] as string;

      if (!userKey || !userAddress) {
        console.error('❌ [ADD-SOURCE] Missing user credentials');
        return res.status(400).json({ error: 'User credentials are required' });
      }

      console.log(`👤 [ADD-SOURCE] User credentials:`, { userKey, userAddress });

      const addedFiles = [];

      for (const fileId of fileIds) {
        try {
          console.log(`📥 [ADD-SOURCE] Processing file: ${fileId}`);
          
          // Get file metadata first
          const { data: meta } = await drive.files.get({
            fileId,
            fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
          });
          
          console.log(`📋 [ADD-SOURCE] File metadata:`, {
            name: meta.name,
            mimeType: meta.mimeType,
            size: meta.size
          });

          // Check if it's a Google Workspace file
          const isGoogleWorkspaceFile = meta.mimeType?.startsWith('application/vnd.google-apps.');
          
          let buffer: Buffer;
          let filename = meta.name!;
          let contentType = meta.mimeType!;

          if (isGoogleWorkspaceFile) {
            // Handle Google Workspace files (Docs, Sheets, Slides, etc.)
            console.log(`📄 [ADD-SOURCE] Google Workspace file detected: ${meta.mimeType}`);
            
            // Determine export MIME type based on Google Workspace type
            let exportMimeType: string;
            let fileExtension: string;
            
            switch (meta.mimeType) {
              case 'application/vnd.google-apps.document':
                exportMimeType = 'application/pdf';
                fileExtension = '.pdf';
                contentType = 'application/pdf';
                break;
              case 'application/vnd.google-apps.spreadsheet':
                exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                fileExtension = '.xlsx';
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                break;
              case 'application/vnd.google-apps.presentation':
                exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                fileExtension = '.pptx';
                contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                break;
              default:
                // Default to PDF for other Google Workspace files
                exportMimeType = 'application/pdf';
                fileExtension = '.pdf';
                contentType = 'application/pdf';
            }
            
            console.log(`🔄 [ADD-SOURCE] Exporting as: ${exportMimeType}`);
            
            // Update filename to include extension if not present
            if (!filename.includes('.')) {
              filename = filename + fileExtension;
            }
            
            // Export the Google Workspace file
            const exportResponse = await drive.files.export({
              fileId,
              mimeType: exportMimeType,
            }, {
              responseType: 'arraybuffer',
            });
            
            buffer = Buffer.from(exportResponse.data as ArrayBuffer);
            console.log(`✅ [ADD-SOURCE] Exported file, size: ${buffer.length} bytes`);
            
          } else {
            // Regular file download
            console.log(`📁 [ADD-SOURCE] Regular file detected, downloading...`);
            
            const download = await drive.files.get(
              { fileId, alt: 'media' },
              { responseType: 'arraybuffer' }
            );
            
            buffer = Buffer.from(download.data as ArrayBuffer);
            console.log(`✅ [ADD-SOURCE] Downloaded file, size: ${buffer.length} bytes`);
          }

          console.log(`📤 [ADD-SOURCE] Uploading "${filename}" (${contentType})`);

          const form = new FormData();
          form.append('file', buffer, { filename, contentType });
          form.append('userKey', userKey);
          form.append('userAddress', userAddress);
          form.append('notebookId', notebookId);
          form.append('sourceType', 'google-drive');
          form.append('sourceId', fileId);
          form.append('sourceMetadata', JSON.stringify({
            googleDriveId: fileId,
            googleDriveName: meta.name,
            googleDriveUrl: meta.webViewLink,
            originalMimeType: meta.mimeType,
            exportedMimeType: contentType,
            modifiedTime: meta.modifiedTime,
            size: meta.size,
            isGoogleWorkspaceFile
          }));

          console.log(`🔍 [ADD-SOURCE] Uploading to: ${baseUrl}/api/sources/upload-file`);

          const uploadResponse = await fetch(`${baseUrl}/api/sources/upload-file`, {
            method: 'POST',
            headers: form.getHeaders(),
            body: form,
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error(`❌ [ADD-SOURCE] Upload failed for "${filename}":`, errorText);
            throw new Error(`Upload failed for ${filename}: ${errorText}`);
          }

          console.log(`✅ [ADD-SOURCE] Successfully uploaded: "${filename}"`);
          addedFiles.push({ 
            id: fileId, 
            name: filename,
            size: meta.size || buffer.length.toString(),
            mimeType: contentType,
            originalMimeType: meta.mimeType,
            isGoogleWorkspaceFile
          });
          
        } catch (fileError: any) {
          console.error(`❌ [ADD-SOURCE] Error processing file ${fileId}:`, fileError.message);
          // Continue processing other files even if one fails
          addedFiles.push({
            id: fileId,
            name: 'Error',
            error: fileError.message,
            success: false
          });
        }
      }

      const successCount = addedFiles.filter(f => !('error' in f)).length;
      const failCount = addedFiles.filter(f => 'error' in f).length;

      console.log(`🎉 [ADD-SOURCE] Processing complete: ${successCount} succeeded, ${failCount} failed`);
      
      return res.json({ 
        success: successCount > 0, 
        message: `Added ${successCount} Google Drive file${successCount !== 1 ? 's' : ''}${failCount > 0 ? `, ${failCount} failed` : ''}`,
        files: addedFiles,
        successCount,
        failCount
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('❌ [GOOGLE-DRIVE] API Error:', error.message || error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
