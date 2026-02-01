
// hooks/useNotebookLMAPI.ts - Custom hook for NotebookLM API integration

import { useState, useCallback } from 'react';
import { useActiveAccount } from '../hooks/useWalletAddress';

interface NotebookLMAPIConfig {
  baseUrl: string;
}

interface UseNotebookLMAPIReturn {
  // State
  loading: boolean;
  error: string | null;

  // Google Auth
  getGoogleAuthUrl: () => Promise<string>;
  checkAuthStatus: () => Promise<{ success: boolean; user?: any }>;

  // Notebooks
  listNotebooks: () => Promise<any[]>;
  getNotebookStatus: (notebookId: string) => Promise<any>;
  syncNotebook: (notebookId: string, options?: any) => Promise<any>;

  // Knowledge Bases
  listKnowledgeBases: () => Promise<any[]>;
  createKnowledgeBase: (data: any) => Promise<any>;
  updateKnowledgeBase: (id: string, data: any) => Promise<any>;
}

export const useNotebookLMAPI = (config?: NotebookLMAPIConfig): UseNotebookLMAPIReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeAccount = useActiveAccount();

  const baseUrl = config?.baseUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const userId = activeAccount?.account?.address || 'anonymous';

  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `API call failed: ${response.status}`);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'API call failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  // Google Authentication
  const getGoogleAuthUrl = useCallback(async (): Promise<string> => {
    const data = await apiCall('/auth/google');
    return data.authUrl;
  }, [apiCall]);

  const checkAuthStatus = useCallback(async () => {
    return await apiCall('/auth/status');
  }, [apiCall]);

  // Notebooks
  const listNotebooks = useCallback(async () => {
    const data = await apiCall('/api/notebooks');
    return data.notebooks || [];
  }, [apiCall]);

  const getNotebookStatus = useCallback(async (notebookId: string) => {
    const data = await apiCall(`/api/notebooks/${notebookId}/status?userId=${userId}`);
    return data;
  }, [apiCall, userId]);

  const syncNotebook = useCallback(async (notebookId: string, options: any = {}) => {
    const data = await apiCall(`/api/notebooks/${notebookId}/sync`, {
      method: 'POST',
      body: JSON.stringify({
        userId,
        ...options
      })
    });
    return data.syncResult;
  }, [apiCall, userId]);

  // Knowledge Bases
  const listKnowledgeBases = useCallback(async () => {
    const data = await apiCall(`/api/knowledge-bases?userId=${userId}`);
    return data.knowledgeBases || [];
  }, [apiCall, userId]);

  const createKnowledgeBase = useCallback(async (kbData: any) => {
    const data = await apiCall('/api/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify({
        ...kbData,
        userId
      })
    });
    return data.knowledgeBase;
  }, [apiCall, userId]);

  const updateKnowledgeBase = useCallback(async (id: string, updateData: any) => {
    const data = await apiCall(`/api/knowledge-bases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...updateData,
        userId
      })
    });
    return data.knowledgeBase;
  }, [apiCall, userId]);

  return {
    loading,
    error,
    getGoogleAuthUrl,
    checkAuthStatus,
    listNotebooks,
    getNotebookStatus,
    syncNotebook,
    listKnowledgeBases,
    createKnowledgeBase,
    updateKnowledgeBase
  };
};
