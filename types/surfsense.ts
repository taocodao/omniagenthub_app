// types/surfsense.ts - 100% TypeScript type definitions

export interface SurfSenseSearchSpace {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  user_id: string;
}

export interface SurfSenseDocument {
  id: number;
  title: string;
  document_type: string;
  created_at: string;
  search_space_id: number;
  user_id: string;
}

export interface SurfSenseChatResponse {
  response: string;
  sources: SurfSenseSource[];
  search_space_id: number;
}

export interface SurfSenseSource {
  id: number;
  title: string;
  relevance_score: number;
  content_snippet: string;
}

export interface SurfSenseError {
  detail: string | Array<{
    type: string;
    loc: string[];
    msg: string;
    input: unknown;
  }>;
}

export interface NotebookSource {
  id: string;
  title: string;
  type: 'file' | 'website' | 'text';
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  fileSize?: string;
  dateCreated: string;
  error?: string;
  fileName?: string;
  selected: boolean;
  surfsenseDocId?: number;
  surfsenseSearchSpaceId?: number;
  fileType?: string;
}

export interface Notebook {
  id: string;
  title: string;
  sources: NotebookSource[];
  sourceCount: number;
  created: string;
  lastUpdated: string;
  userAddress: string;
  surfsenseSearchSpaceId?: number;
}
