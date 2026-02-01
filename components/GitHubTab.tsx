/* eslint-disable react-hooks/exhaustive-deps */
/**
 * GitHub Tab Component
 * Provides GitHub authentication and repository/file selection interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GitHubTabProps,
  GitHubRepository,
  GitHubRepoContents,
  GitHubTreeItem,
  AuthStatus,
  SourceItem
} from '../types/oauth';

interface GitHubTabState {
  authStatus: AuthStatus;
  isLoading: boolean;
  error: string | null;
  repositories: GitHubRepository[];
  selectedRepo: GitHubRepository | null;
  repoContents: GitHubRepoContents | null;
  selectedFiles: Set<string>;
  currentPath: string;
}

const GitHubTab: React.FC<GitHubTabProps> = ({
  notebookId,
  onSourceAdded,
  onClose
}) => {
  const [state, setState] = useState<GitHubTabState>({
    authStatus: 'idle',
    isLoading: false,
    error: null,
    repositories: [],
    selectedRepo: null,
    repoContents: null,
    selectedFiles: new Set(),
    currentPath: ''
  });

  // ✅ MOVED: Define checkAuthStatus BEFORE useEffect
  const checkAuthStatus = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const response = await fetch(`/api/oauth/github?action=repositories&notebookId=${notebookId}`);
      
      if (response.ok) {
        const repositories = await response.json();
        setState(prev => ({
          ...prev,
          authStatus: 'authenticated',
          repositories,
          isLoading: false
        }));
      } else if (response.status === 401) {
        setState(prev => ({
          ...prev,
          authStatus: 'idle',
          isLoading: false
        }));
      } else {
        throw new Error('Failed to check auth status');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        authStatus: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false
      }));
    }
  }, [notebookId]);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const handleAuthenticate = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, authStatus: 'authenticating', error: null }));
      const response = await fetch(`/api/oauth/github?action=authorize&notebookId=${notebookId}`);
      const data = await response.json();

      if (data.success && data.authUrl) {
        // Open OAuth window
        const authWindow = window.open(
          data.authUrl,
          'github-auth',
          'width=600,height=600,scrollbars=yes,resizable=yes'
        );

        // Listen for auth completion
        const checkAuthComplete = setInterval(async () => {
          try {
            if (authWindow?.closed) {
              clearInterval(checkAuthComplete);
              await checkAuthStatus(); // Recheck auth status
            }
          } catch (error) {
            clearInterval(checkAuthComplete);
            setState(prev => ({
              ...prev,
              authStatus: 'error',
              error: 'Authentication failed'
            }));
          }
        }, 1000);
      } else {
        throw new Error(data.error || 'Failed to start authentication');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        authStatus: 'error',
        error: error instanceof Error ? error.message : 'Authentication failed'
      }));
    }
  }, [notebookId, checkAuthStatus]);

  const handleRepoSelect = async (repo: GitHubRepository) => {
    try {
      setState(prev => ({
        ...prev,
        selectedRepo: repo,
        isLoading: true,
        currentPath: '',
        selectedFiles: new Set()
      }));

      const [owner, repoName] = repo.full_name.split('/');
      const response = await fetch(
        `/api/oauth/github?action=contents&notebookId=${notebookId}&owner=${owner}&repo=${repoName}`
      );

      if (response.ok) {
        const contents = await response.json();
        setState(prev => ({
          ...prev,
          repoContents: contents,
          isLoading: false
        }));
      } else {
        throw new Error('Failed to load repository contents');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load repository',
        isLoading: false
      }));
    }
  };

  const handlePathClick = async (item: GitHubTreeItem) => {
    if (item.type === 'tree' && state.selectedRepo) {
      try {
        setState(prev => ({ ...prev, isLoading: true }));
        const [owner, repoName] = state.selectedRepo.full_name.split('/');
        const response = await fetch(
          `/api/oauth/github?action=contents&notebookId=${notebookId}&owner=${owner}&repo=${repoName}&path=${item.path}`
        );

        if (response.ok) {
          const contents = await response.json();
          setState(prev => ({
            ...prev,
            repoContents: contents,
            currentPath: item.path,
            isLoading: false
          }));
        } else {
          throw new Error('Failed to load directory contents');
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load directory',
          isLoading: false
        }));
      }
    }
  };

  const handleFileSelect = (filePath: string) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedFiles);
      if (newSelected.has(filePath)) {
        newSelected.delete(filePath);
      } else {
        newSelected.add(filePath);
      }
      return { ...prev, selectedFiles: newSelected };
    });
  };

  const handleAddSources = async () => {
    if (state.selectedFiles.size === 0 || !state.selectedRepo) return;

    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const [owner, repoName] = state.selectedRepo.full_name.split('/');
      const response = await fetch('/api/oauth/github?action=add-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          owner,
          repo: repoName,
          paths: Array.from(state.selectedFiles)
        })
      });

      const result = await response.json();
      if (result.success) {
        // Convert selected files to SourceItem format
        const selectedSources: SourceItem[] = Array.from(state.selectedFiles).map(path => {
          const item = state.repoContents?.items.find(i => i.path === path);
          return {
            id: `${state.selectedRepo!.full_name}/${path}`,
            name: path.split('/').pop() || path,
            type: 'github',
            url: `${state.selectedRepo!.html_url}/blob/${state.selectedRepo!.default_branch}/${path}`,
            path: path,
            size: item?.size?.toString(),
            metadata: {
              repository: state.selectedRepo!.full_name,
              sha: item?.sha
            }
          };
        });

        onSourceAdded(selectedSources);
        onClose();
      } else {
        throw new Error(result.error || 'Failed to add sources');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to add sources',
        isLoading: false
      }));
    }
  };

  const handleBack = () => {
    if (state.repoContents?.parentPath !== undefined) {
      if (state.repoContents.parentPath === '') {
        // Go back to root
        handleRepoSelect(state.selectedRepo!);
      } else {
        // Navigate to parent directory
        const parentItem: GitHubTreeItem = {
          path: state.repoContents.parentPath,
          mode: '040000',
          type: 'tree',
          sha: '',
          url: ''
        };
        handlePathClick(parentItem);
      }
    } else if (state.selectedRepo) {
      // Go back to repository list
      setState(prev => ({
        ...prev,
        selectedRepo: null,
        repoContents: null,
        selectedFiles: new Set(),
        currentPath: ''
      }));
    }
  };

  // Render authentication screen
  if (state.authStatus !== 'authenticated') {
    return (
      <div style={{ textAlign: 'center', padding: '20px 10px' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px', color: '#24292e' }}>🐙</div>
        
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px', color: '#000' }}>
          Connect GitHub
        </h3>
        
        <p style={{ color: '#000', marginBottom: '12px', fontSize: '12px', lineHeight: '1.4' }}>
          Access your GitHub repositories and files to add them as sources for your notebook.
        </p>

        {state.error && (
          <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '8px', padding: '6px', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
            {state.error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            onClick={handleAuthenticate}
            disabled={state.authStatus === 'authenticating'}
            style={{
              backgroundColor: '#24292e',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: state.authStatus === 'authenticating' ? 'not-allowed' : 'pointer',
              opacity: state.authStatus === 'authenticating' ? 0.6 : 1
            }}
          >
            {state.authStatus === 'authenticating' ? 'Connecting...' : 'Connect GitHub'}
          </button>

          <button
            onClick={onClose}
            style={{
              backgroundColor: '#f5f5f5',
              color: '#666',
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #ddd',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Render repository list
  if (!state.selectedRepo) {
    return (
      <div style={{ padding: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: '#000' }}>Select Repository</h3>
        
        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
          {state.repositories.map(repo => (
            <div
              key={repo.id}
              onClick={() => handleRepoSelect(repo)}
              style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: '12px', color: '#000' }}
            >
              <div style={{ fontWeight: 600 }}>{repo.name}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>{repo.full_name}</div>
              {repo.description && (
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{repo.description}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render file browser
  return (
    <div style={{ padding: '10px' }}>
      {/* Header */}
      <div style={{ marginBottom: '10px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#000', margin: 0 }}>
          {state.selectedRepo.name}
          {state.currentPath && (
            <span style={{ color: '#666', fontSize: '12px' }}> / {state.currentPath}</span>
          )}
        </h3>
      </div>

      {/* Navigation */}
      <button
        onClick={handleBack}
        style={{
          backgroundColor: 'transparent',
          color: '#24292e',
          border: 'none',
          padding: '4px 0',
          fontSize: '12px',
          cursor: 'pointer',
          marginBottom: '8px'
        }}
      >
        ← Back
      </button>

      {state.error && (
        <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '8px', padding: '6px', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
          {state.error}
        </div>
      )}

      {/* File List */}
      <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '10px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
        {state.isLoading ? (
          <div style={{ padding: '10px', textAlign: 'center', color: '#666', fontSize: '12px' }}>Loading...</div>
        ) : state.repoContents ? (
          <>
            {state.repoContents.items.map(item => (
              <div
                key={item.path}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid #f3f4f6', fontSize: '12px', color: '#000' }}
              >
                {item.type === 'blob' && (
                  <input
                    type="checkbox"
                    checked={state.selectedFiles.has(item.path)}
                    onChange={() => handleFileSelect(item.path)}
                    style={{ marginRight: '6px' }}
                  />
                )}
                <span
                  onClick={() => item.type === 'tree' && handlePathClick(item)}
                  style={{ cursor: item.type === 'tree' ? 'pointer' : 'default', display: 'flex', alignItems: 'center', flex: 1 }}
                >
                  <span style={{ marginRight: '6px' }}>{item.type === 'tree' ? '📁' : '📄'}</span>
                  <span>{item.path.split('/').pop()}</span>
                </span>
              </div>
            ))}

            {state.repoContents.items.length === 0 && (
              <div style={{ padding: '10px', textAlign: 'center', color: '#999', fontSize: '12px' }}>This directory is empty</div>
            )}
          </>
        ) : (
          <div style={{ padding: '10px', textAlign: 'center', color: '#999', fontSize: '12px' }}>No contents available</div>
        )}
      </div>

      {/* Actions */}
      {state.selectedFiles.size > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
          <span style={{ fontSize: '11px', color: '#000' }}>
            {state.selectedFiles.size} file{state.selectedFiles.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleAddSources}
            disabled={state.isLoading}
            style={{
              backgroundColor: '#24292e',
              color: 'white',
              padding: '6px 14px',
              borderRadius: '4px',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: state.isLoading ? 'not-allowed' : 'pointer',
              opacity: state.isLoading ? 0.6 : 1
            }}
          >
            Add Sources
          </button>
        </div>
      )}
    </div>
  );
};

export default GitHubTab;
