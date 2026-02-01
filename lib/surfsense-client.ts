// lib/surfsense-client.ts
const SURFSENSE_API_URL = process.env.NEXT_PUBLIC_SURFSENSE_API_URL || 'https://surfsense-backend-6iucxb6k5a-uc.a.run.app';

export interface SurfSenseDocument {
  id: number;
  title: string;
  file_type: string;
  content_preview: string;
  upload_date: string;
  search_space_id: number;
  status: 'processing' | 'completed' | 'failed';
}

export interface SurfSenseSearchSpace {
  id: number;
  name: string;
  description?: string;
  document_count: number;
  created_at: string;
}

export interface SurfSenseChatResponse {
  response: string;
  sources: Array<{
    id: number;
    title: string;
    relevance_score: number;
    content_snippet: string;
  }>;
  search_space_id: number;
}

class SurfSenseClient {
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string = SURFSENSE_API_URL) {
    this.baseURL = baseURL;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  // === SEARCH SPACES (Knowledge Bases) ===
  
  async createSearchSpace(name: string, description?: string): Promise<SurfSenseSearchSpace> {
    const response = await fetch(`${this.baseURL}/api/v1/search_spaces/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, description })
    });

    if (!response.ok) {
      throw new Error(`Failed to create search space: ${response.status}`);
    }

    return response.json();
  }

  async listSearchSpaces(): Promise<SurfSenseSearchSpace[]> {
    const response = await fetch(`${this.baseURL}/api/v1/search_spaces/`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to list search spaces: ${response.status}`);
    }

    return response.json();
  }

  async getSearchSpace(spaceId: number): Promise<SurfSenseSearchSpace> {
    const response = await fetch(`${this.baseURL}/api/v1/search_spaces/${spaceId}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get search space: ${response.status}`);
    }

    return response.json();
  }

  // === DOCUMENTS ===

  async uploadDocument(file: File, searchSpaceId: number, onProgress?: (progress: number) => void): Promise<SurfSenseDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('search_space_id', searchSpaceId.toString());

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });

      xhr.open('POST', `${this.baseURL}/api/v1/documents/upload`);
      
      if (this.authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${this.authToken}`);
      }

      xhr.send(formData);
    });
  }

  async listDocuments(searchSpaceId: number, page: number = 0, pageSize: number = 10): Promise<SurfSenseDocument[]> {
    const params = new URLSearchParams({
      search_space_id: searchSpaceId.toString(),
      page: page.toString(),
      page_size: pageSize.toString()
    });

    const response = await fetch(`${this.baseURL}/api/v1/documents/?${params}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to list documents: ${response.status}`);
    }

    return response.json();
  }

  async deleteDocument(documentId: number): Promise<void> {
    const response = await fetch(`${this.baseURL}/api/v1/documents/${documentId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response.status}`);
    }
  }

  async searchDocuments(query: string, searchSpaceId: number): Promise<SurfSenseDocument[]> {
    const params = new URLSearchParams({
      query,
      search_space_id: searchSpaceId.toString()
    });

    const response = await fetch(`${this.baseURL}/api/v1/documents/search/?${params}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to search documents: ${response.status}`);
    }

    return response.json();
  }

  // === RAG CHAT ===

  async chat(message: string, searchSpaceId: number, conversationHistory?: Array<{role: string, content: string}>): Promise<SurfSenseChatResponse> {
    const response = await fetch(`${this.baseURL}/api/v1/chats/`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        message,
        search_space_id: searchSpaceId,
        conversation_history: conversationHistory
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat failed: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // === STREAMING CHAT ===

  async* streamChat(message: string, searchSpaceId: number): AsyncGenerator<string> {
    const response = await fetch(`${this.baseURL}/api/v1/chats/stream`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        message,
        search_space_id: searchSpaceId
      })
    });

    if (!response.ok) {
      throw new Error(`Stream chat failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      yield chunk;
    }
  }
}

export const surfsenseClient = new SurfSenseClient();
