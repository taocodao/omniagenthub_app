/**
 * OAuth Integration Types
 * Shared TypeScript interfaces for Google Drive and GitHub integrations
 */

// Base OAuth interfaces
export interface OAuthProvider {
  id: 'google-drive' | 'github';
  name: string;
  icon: string;
  isAuthenticated: boolean;
}

export interface OAuthState {
  googleDrive: {
    isAuthenticated: boolean;
    currentFolderId?: string;
    currentPath?: string;
  };
  github: {
    isAuthenticated: boolean;
    currentOwner?: string;
    currentRepo?: string;
    currentPath?: string;
  };
}

// Component Props
export interface GoogleDriveTabProps {
  notebookId: string;
  userKey: string;        // Added
  userAddress: string;    // Added
  onSourceAdded: (sources: SourceItem[]) => void;
  onClose: () => void;
}

export interface GitHubTabProps {
  notebookId: string;
  userKey: string;        // Added
  userAddress: string;    // Added
  onSourceAdded: (sources: SourceItem[]) => void;
  onClose: () => void;
}

// Source item for unified handling
export interface SourceItem {
  id: string;
  name: string;
  type: 'google-drive' | 'github' | 'youtube' | 'website' | 'file';
  url?: string;
  path?: string;
  size?: string;
  lastModified?: string;
  metadata?: Record<string, any>;
}

// Google Drive specific types
export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  webViewLink: string;
  parents?: string[];
  isFolder: boolean;
}

export interface GoogleDriveFolderContents {
  files: GoogleDriveFile[];
  folders: GoogleDriveFile[];
  currentPath: string;
  parentId?: string;
}

// GitHub specific types
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  updated_at: string;
  language: string | null;
  size: number;
  default_branch: string;
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubRepoContents {
  repository: GitHubRepository;
  items: GitHubTreeItem[];
  currentPath: string;
  parentPath?: string;
}

// API Response types
export interface AuthResponse {
  success: boolean;
  authUrl?: string;
  accessToken?: string;
  error?: string;
}

export interface AddSourceResponse {
  success: boolean;
  error?: string;
}

// Tab state management
export type TabType = 'upload' | 'website' | 'paste' | 'youtube' | 'google-drive' | 'github';

export interface TabState {
  activeTab: TabType;
  isAuthenticated: {
    'google-drive': boolean;
    'github': boolean;
  };
}

// Selection state for file/folder browsers
export interface SelectionState {
  selectedItems: string[];
  isSelectMode: boolean;
}

// Authentication flow states
export type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'error';

export interface AuthFlowState {
  status: AuthStatus;
  error?: string;
  authUrl?: string;
}
