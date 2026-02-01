
// types/notebooklm.ts - TypeScript definitions for NotebookLM integration

export interface NotebookLMUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface NotebookLMNotebook {
  id: string;
  title: string;
  sources: number;
  lastModified?: string;
  isSynced?: boolean;
  vectorCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  vectorCount: number;
  lastSync: string;
  userId: string;
  roleContext?: {
    role: string;
    department?: string;
    task?: string;
  };
  notebookConnections?: {
    notebookId: string;
    syncedAt: string;
    vectorCount: number;
  }[];
}

export interface SyncProgress {
  phase: 'idle' | 'authenticating' | 'fetching' | 'syncing' | 'complete' | 'error';
  progress: number;
  message: string;
  details?: string;
  startTime?: Date;
  estimatedTimeRemaining?: number;
}

export interface SyncResult {
  notebookId: string;
  title: string;
  sources: string[];
  lastSync: Date;
  pineconeVectors: number;
  knowledgeBaseId?: string;
}

export interface NotebookLMAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface GoogleAuthResponse {
  success: boolean;
  authUrl?: string;
  user?: NotebookLMUser;
  access_token?: string;
  refresh_token?: string;
}

export interface NotebookLMSyncOptions {
  forceRefresh?: boolean;
  chunkSize?: number;
  overlapSize?: number;
  knowledgeBaseId?: string;
  roleContext?: {
    role: string;
    department?: string;
    task?: string;
  };
}

export interface KnowledgeBaseCreateRequest {
  name: string;
  description?: string;
  userId: string;
  roleContext?: {
    role: string;
    department?: string;
    task?: string;
  };
}

export interface NotebookLMModalProps {
  visible: boolean;
  onClose: () => void;
  selectedRole?: {
    role: string;
    department?: string;
    task?: string;
  };
  onKnowledgeBaseUpdated?: (kbId: string, notebookId: string) => void;
  initialNotebookId?: string;
  initialKnowledgeBaseId?: string;
}

export interface KnowledgeBaseStatus {
  isConnected: boolean;
  notebookCount: number;
  totalVectors: number;
  lastSync?: Date;
  connectedNotebooks?: {
    id: string;
    title: string;
    vectorCount: number;
    syncedAt: Date;
  }[];
}
