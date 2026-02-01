/* eslint-disable react-hooks/exhaustive-deps */
// components/KnowledgeSelectTab.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

interface SourceWithSummary {
  id: string;
  title: string;
  type: 'file' | 'website' | 'text';
  fileName?: string;
  url?: string;
  sourceType?: string;
  sourceUrl?: string;
  summary?: string;
  selected: boolean;
  isLoadingSummary?: boolean;
}

interface NotebookWithSources {
  id: string;
  title: string;
  sourceCount: number;
  dateCreated: string;
  sources: SourceWithSummary[];
  expanded: boolean;
  isLoadingSources?: boolean;
}

interface KnowledgeSelectTabProps {
  userKey: string;
  userAddress: string;
  onClose: () => void;
  onSourcesSelected: (sources: SourceWithSummary[]) => void;
}

const KnowledgeSelectTab: React.FC<KnowledgeSelectTabProps> = ({
  userKey,
  userAddress,
  onClose,
  onSourcesSelected,
}) => {
  const [notebooks, setNotebooks] = useState<NotebookWithSources[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load all notebooks on mount
  useEffect(() => {
    loadNotebooks();
  }, [userKey]);

  const loadNotebooks = useCallback(async () => {
    if (!userKey) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 [KNOWLEDGE-SELECT] Loading notebooks for user:', userKey);

      const response = await fetch(`/api/notebooks/list?userKey=${encodeURIComponent(userKey)}`);
      
      if (!response.ok) {
        throw new Error('Failed to load notebooks');
      }

      const data = await response.json();
      
      const notebooksData: NotebookWithSources[] = (data.notebooks || []).map((nb: any) => ({
        id: nb.id,
        title: nb.title,
        sourceCount: nb.sourceCount || 0,
        dateCreated: nb.dateCreated,
        sources: [],
        expanded: false,
        isLoadingSources: false,
      }));

      console.log(`✅ [KNOWLEDGE-SELECT] Loaded ${notebooksData.length} notebooks`);
      setNotebooks(notebooksData);
    } catch (error) {
      console.error('❌ [KNOWLEDGE-SELECT] Error loading notebooks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load notebooks');
      toast.error('Failed to load notebooks');
    } finally {
      setIsLoading(false);
    }
  }, [userKey]);

  const toggleNotebook = async (notebookId: string) => {
    const notebook = notebooks.find(nb => nb.id === notebookId);
    if (!notebook) return;

    // If already expanded, just collapse
    if (notebook.expanded) {
      setNotebooks(prev =>
        prev.map(nb =>
          nb.id === notebookId ? { ...nb, expanded: false } : nb
        )
      );
      return;
    }

    // If sources already loaded, just expand
    if (notebook.sources.length > 0) {
      setNotebooks(prev =>
        prev.map(nb =>
          nb.id === notebookId ? { ...nb, expanded: true } : nb
        )
      );
      return;
    }

    // Load sources for this notebook
    try {
      setNotebooks(prev =>
        prev.map(nb =>
          nb.id === notebookId ? { ...nb, isLoadingSources: true } : nb
        )
      );

      console.log('🔍 [KNOWLEDGE-SELECT] Loading sources for notebook:', notebookId);

      const response = await fetch(
        `/api/sources/list?userKey=${encodeURIComponent(userKey)}&notebookId=${encodeURIComponent(notebookId)}`
      );

      if (!response.ok) {
        throw new Error('Failed to load sources');
      }

      const data = await response.json();
      const sources: SourceWithSummary[] = (data.sources || []).map((src: any) => ({
        id: src.id,
        title: src.title,
        type: src.type,
        fileName: src.fileName,
        url: src.url,
        sourceType: src.sourceType,
        sourceUrl: src.sourceUrl,
        summary: src.summary || null,
        selected: false,
        isLoadingSummary: false,
      }));

      console.log(`✅ [KNOWLEDGE-SELECT] Loaded ${sources.length} sources for notebook ${notebookId}`);

      setNotebooks(prev =>
        prev.map(nb =>
          nb.id === notebookId
            ? { ...nb, sources, expanded: true, isLoadingSources: false }
            : nb
        )
      );

      // Auto-generate summaries for sources that don't have them
      sources.forEach(source => {
        if (!source.summary) {
          generateSummary(notebookId, source.id);
        }
      });
    } catch (error) {
      console.error('❌ [KNOWLEDGE-SELECT] Error loading sources:', error);
      toast.error('Failed to load sources');
      setNotebooks(prev =>
        prev.map(nb =>
          nb.id === notebookId ? { ...nb, isLoadingSources: false } : nb
        )
      );
    }
  };

  const generateSummary = async (notebookId: string, sourceId: string) => {
    try {
      setNotebooks(prev =>
        prev.map(nb =>
          nb.id === notebookId
            ? {
                ...nb,
                sources: nb.sources.map(src =>
                  src.id === sourceId ? { ...src, isLoadingSummary: true } : src
                ),
              }
            : nb
        )
      );

      console.log('🤖 [KNOWLEDGE-SELECT] Generating summary for source:', sourceId);

      const response = await fetch('/api/knowledge/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userKey,
          notebookId,
          sourceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const data = await response.json();
      const summary = data.summary;

      console.log(`✅ [KNOWLEDGE-SELECT] Generated summary for source ${sourceId}`);

      setNotebooks(prev =>
        prev.map(nb =>
          nb.id === notebookId
            ? {
                ...nb,
                sources: nb.sources.map(src =>
                  src.id === sourceId
                    ? { ...src, summary, isLoadingSummary: false }
                    : src
                ),
              }
            : nb
        )
      );
    } catch (error) {
      console.error('❌ [KNOWLEDGE-SELECT] Error generating summary:', error);
      setNotebooks(prev =>
        prev.map(nb =>
          nb.id === notebookId
            ? {
                ...nb,
                sources: nb.sources.map(src =>
                  src.id === sourceId
                    ? { ...src, summary: 'Failed to generate summary', isLoadingSummary: false }
                    : src
                ),
              }
            : nb
        )
      );
    }
  };

  const toggleSourceSelection = (notebookId: string, sourceId: string) => {
    setNotebooks(prev =>
      prev.map(nb =>
        nb.id === notebookId
          ? {
              ...nb,
              sources: nb.sources.map(src =>
                src.id === sourceId ? { ...src, selected: !src.selected } : src
              ),
            }
          : nb
      )
    );
  };

  const selectAllInNotebook = (notebookId: string) => {
    setNotebooks(prev =>
      prev.map(nb =>
        nb.id === notebookId
          ? {
              ...nb,
              sources: nb.sources.map(src => ({ ...src, selected: true })),
            }
          : nb
      )
    );
  };

  const deselectAllInNotebook = (notebookId: string) => {
    setNotebooks(prev =>
      prev.map(nb =>
        nb.id === notebookId
          ? {
              ...nb,
              sources: nb.sources.map(src => ({ ...src, selected: false })),
            }
          : nb
      )
    );
  };

  const handleConfirmSelection = () => {
    const selectedSources: SourceWithSummary[] = [];
    notebooks.forEach(nb => {
      nb.sources.forEach(src => {
        if (src.selected) {
          selectedSources.push(src);
        }
      });
    });

    if (selectedSources.length === 0) {
      toast.warning('Please select at least one source');
      return;
    }

    console.log(`✅ [KNOWLEDGE-SELECT] Selected ${selectedSources.length} sources`);
    onSourcesSelected(selectedSources);
    onClose();
  };

  const filteredNotebooks = notebooks.filter(nb =>
    nb.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSelected = notebooks.reduce(
    (sum, nb) => sum + nb.sources.filter(src => src.selected).length,
    0
  );

  return (
    <div style={{ 
      padding: '24px',
      maxHeight: '80vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>
          Select Knowledge Sources
        </h2>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Choose sources from your notebooks to include in your knowledge base
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search notebooks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Notebooks List */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        marginBottom: '16px',
      }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            Loading notebooks...
          </div>
        ) : error ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
            {error}
          </div>
        ) : filteredNotebooks.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            No notebooks found
          </div>
        ) : (
          filteredNotebooks.map(notebook => (
            <div key={notebook.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              {/* Notebook Header */}
              <div
                onClick={() => toggleNotebook(notebook.id)}
                style={{
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: notebook.expanded ? '#f9fafb' : 'white',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!notebook.expanded) {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!notebook.expanded) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span style={{ marginRight: '12px', fontSize: '18px' }}>
                    {notebook.expanded ? '📖' : '📕'}
                  </span>
                  <div>
                    <div style={{ fontWeight: '500', color: '#1f2937', marginBottom: '4px' }}>
                      {notebook.title}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {notebook.sourceCount} source{notebook.sourceCount !== 1 ? 's' : ''}
                      {notebook.sources.length > 0 && (
                        <span> · {notebook.sources.filter(s => s.selected).length} selected</span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {notebook.expanded && notebook.sources.length > 0 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllInNotebook(notebook.id);
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          backgroundColor: 'transparent',
                          color: '#3b82f6',
                          border: '1px solid #3b82f6',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Select All
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deselectAllInNotebook(notebook.id);
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          backgroundColor: 'transparent',
                          color: '#6b7280',
                          border: '1px solid #d1d5db',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        Clear
                      </button>
                    </>
                  )}
                  <span style={{ fontSize: '18px', color: '#6b7280' }}>
                    {notebook.expanded ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {/* Sources List */}
              {notebook.expanded && (
                <div style={{ backgroundColor: '#f9fafb', padding: '8px 16px' }}>
                  {notebook.isLoadingSources ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                      Loading sources...
                    </div>
                  ) : notebook.sources.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                      No sources in this notebook
                    </div>
                  ) : (
                    notebook.sources.map(source => (
                      <div
                        key={source.id}
                        style={{
                          backgroundColor: 'white',
                          border: source.selected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                          borderRadius: '6px',
                          padding: '12px',
                          marginBottom: '8px',
                          display: 'flex',
                          gap: '12px',
                        }}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={source.selected}
                          onChange={() => toggleSourceSelection(notebook.id, source.id)}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                            marginTop: '2px',
                          }}
                        />

                        {/* Source Info */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            {/* Source Type Badge */}
                            {source.sourceType === 'google-drive' && (
                              <span
                                style={{
                                  backgroundColor: '#4285f4',
                                  color: 'white',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                G
                              </span>
                            )}
                            {source.sourceType === 'github' && (
                              <span
                                style={{
                                  backgroundColor: '#24292e',
                                  color: 'white',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                GH
                              </span>
                            )}
                            {source.type === 'website' && (
                              <span
                                style={{
                                  backgroundColor: '#10b981',
                                  color: 'white',
                                  fontSize: '10px',
                                  fontWeight: '600',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                WEB
                              </span>
                            )}

                            {/* Source Title */}
                            <div style={{ fontWeight: '500', fontSize: '14px', color: '#1f2937' }}>
                              {source.fileName || source.title}
                            </div>
                          </div>

                          {/* Source Summary */}
                          <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                            {source.isLoadingSummary ? (
                              <span style={{ fontStyle: 'italic' }}>Generating summary...</span>
                            ) : source.summary ? (
                              source.summary
                            ) : (
                              <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>
                                No summary available
                              </span>
                            )}
                          </div>

                          {/* Source URL */}
                          {(source.sourceUrl || source.url) && (
                            <a
                              href={source.sourceUrl || source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '12px',
                                color: '#3b82f6',
                                textDecoration: 'none',
                                marginTop: '6px',
                                display: 'inline-block',
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              View Original →
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
      }}>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>
          {totalSelected} source{totalSelected !== 1 ? 's' : ''} selected
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmSelection}
            disabled={totalSelected === 0}
            style={{
              padding: '10px 20px',
              backgroundColor: totalSelected > 0 ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: totalSelected > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeSelectTab;
