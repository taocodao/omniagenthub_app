'use client';
import React, { useState, useEffect } from 'react';
import { LocalizedText } from '../util/LocalizedText';

interface Source {
    id: string;
    name: string;
    type: string;
    selected: boolean;
}

interface Notebook {
    name: string;
    displayName: string;
    sources: Source[];
    expanded: boolean;
    selected: boolean;
}

interface SourceSelectorProps {
    userKey: string;
    onSelectionChange: (sourceIds: string[]) => void;
    mcpEndpoint?: string;
}

const SourceSelector: React.FC<SourceSelectorProps> = ({
    userKey,
    onSelectionChange,
    mcpEndpoint = process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3005',
}) => {
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Fetch notebooks on mount AND when userKey changes
    useEffect(() => {
        console.log('[SourceSelector] useEffect triggered, userKey=', userKey);
        if (userKey) {
            console.log('[SourceSelector] userKey is set, fetching notebooks...');
            fetchNotebooksAndApplySavedSelection();
        } else {
            console.log('[SourceSelector] userKey is empty/undefined, skipping fetch');
        }
    }, [userKey]);

    const fetchNotebooksAndApplySavedSelection = async () => {
        setIsLoading(true);
        try {
            // First, get saved selection
            const savedRes = await fetch(`${mcpEndpoint}/user/source-selection`, {
                headers: { 'X-Wallet-Address': userKey },
            });
            const savedData = await savedRes.json();
            const savedSourceIds = (savedData.success && savedData.sourceIds) ? savedData.sourceIds : [];
            console.log('[SourceSelector] Loaded saved selection:', savedSourceIds);

            // Then fetch notebooks and apply saved selection
            const res = await fetch(`${mcpEndpoint}/tools/list_stores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userWallet: userKey }),
            });
            const data = await res.json();
            if (data.success) {
                const notebooksWithSources = await Promise.all(
                    (data.stores || []).map(async (store: any) => {
                        const sourcesRes = await fetch(`${mcpEndpoint}/tools/list_sources`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ storeName: store.name }),
                        });
                        const sourcesData = await sourcesRes.json();
                        const sources = (sourcesData.sources || []).map((s: any) => ({
                            id: s.id,
                            name: s.name,
                            type: s.type,
                            selected: savedSourceIds.includes(s.id), // Apply saved selection here!
                        }));
                        return {
                            name: store.name,
                            displayName: store.displayName,
                            sources: sources,
                            expanded: sources.some((s: any) => s.selected), // Auto-expand if has selection
                            selected: sources.length > 0 && sources.every((s: any) => s.selected),
                        };
                    })
                );
                setNotebooks(notebooksWithSources);

                // Notify parent of loaded selection
                if (savedSourceIds.length > 0) {
                    onSelectionChange(savedSourceIds);
                }
            }
        } catch (e) {
            console.error('Failed to fetch notebooks:', e);
        }
        setIsLoading(false);
    };

    // No longer needed as separate function - merged into fetchNotebooksAndApplySavedSelection
    const loadSavedSelection = async () => {
        try {
            const res = await fetch(`${mcpEndpoint}/user/source-selection`, {
                headers: { 'X-Wallet-Address': userKey },
            });
            const data = await res.json();
            console.log('[SourceSelector] Loaded saved selection:', data);
            if (data.success && data.sourceIds && data.sourceIds.length > 0) {
                // Apply saved selection to notebooks
                setNotebooks(prev => prev.map(nb => ({
                    ...nb,
                    sources: nb.sources.map(s => ({
                        ...s,
                        selected: data.sourceIds.includes(s.id),
                    })),
                    selected: nb.sources.every(s => data.sourceIds.includes(s.id)),
                })));
                // Notify parent of loaded selection
                onSelectionChange(data.sourceIds);
            }
        } catch (e) {
            console.error('Failed to load saved selection:', e);
        }
    };

    const saveSelection = async (sourceIds: string[]) => {
        console.log('[SourceSelector] Saving selection:', sourceIds);
        try {
            const res = await fetch(`${mcpEndpoint}/user/source-selection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': userKey },
                body: JSON.stringify({ sourceIds }),
            });
            const data = await res.json();
            console.log('[SourceSelector] Save response:', data);
        } catch (e) {
            console.error('Failed to save selection:', e);
        }
    };

    const toggleNotebook = (notebookName: string) => {
        setNotebooks(prev => prev.map(nb =>
            nb.name === notebookName ? { ...nb, expanded: !nb.expanded } : nb
        ));
    };

    const toggleNotebookSelection = (notebookName: string) => {
        const updated = notebooks.map(nb => {
            if (nb.name === notebookName) {
                const newSelected = !nb.selected;
                return {
                    ...nb,
                    selected: newSelected,
                    sources: nb.sources.map(s => ({ ...s, selected: newSelected })),
                };
            }
            return nb;
        });
        setNotebooks(updated);
        updateSelection(updated);
    };

    const toggleSourceSelection = (notebookName: string, sourceId: string) => {
        const updated = notebooks.map(nb => {
            if (nb.name === notebookName) {
                const newSources = nb.sources.map(s =>
                    s.id === sourceId ? { ...s, selected: !s.selected } : s
                );
                return {
                    ...nb,
                    sources: newSources,
                    selected: newSources.every(s => s.selected),
                };
            }
            return nb;
        });
        setNotebooks(updated);
        updateSelection(updated);
    };

    const updateSelection = (nbs: Notebook[]) => {
        const selectedIds = nbs.flatMap(nb =>
            nb.sources.filter(s => s.selected).map(s => s.id)
        );
        onSelectionChange(selectedIds);
        saveSelection(selectedIds);
    };

    const selectedCount = notebooks.reduce(
        (acc, nb) => ({
            notebooks: acc.notebooks + (nb.sources.some(s => s.selected) ? 1 : 0),
            sources: acc.sources + nb.sources.filter(s => s.selected).length,
        }),
        { notebooks: 0, sources: 0 }
    );

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            {/* Trigger Button */}
            <button
                onClick={() => {
                    const newIsOpen = !isOpen;
                    setIsOpen(newIsOpen);
                    // Refresh sources from database every time dropdown is opened
                    if (newIsOpen) {
                        fetchNotebooksAndApplySavedSelection();
                    }
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    backgroundColor: selectedCount.sources > 0 ? '#4f46e5' : '#333',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                }}
            >
                📚 <LocalizedText name="Sources" /> {isOpen ? '▲' : '▼'}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                }}>
                    {isLoading ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#888' }}>
                            <LocalizedText name="Loading notebooks..." />
                        </div>
                    ) : notebooks.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#888' }}>
                            <LocalizedText name="No notebooks found. Create one in Knowledge Base." />
                        </div>
                    ) : (
                        notebooks.map(nb => (
                            <div key={nb.name} style={{ borderBottom: '1px solid #333' }}>
                                {/* Notebook Header */}
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        backgroundColor: nb.sources.some(s => s.selected) ? '#2d2d4a' : 'transparent',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={nb.selected}
                                        onChange={() => toggleNotebookSelection(nb.name)}
                                        style={{ accentColor: '#8b5cf6', marginRight: '8px' }}
                                    />
                                    <span
                                        onClick={() => toggleNotebook(nb.name)}
                                        style={{ flex: 1, fontSize: '13px', fontWeight: '500' }}
                                    >
                                        📓 {nb.displayName}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#888' }}>
                                        ({nb.sources.filter(s => s.selected).length}/{nb.sources.length})
                                    </span>
                                    <span
                                        onClick={() => toggleNotebook(nb.name)}
                                        style={{ marginLeft: '8px', fontSize: '10px', color: '#666' }}
                                    >
                                        {nb.expanded ? '▼' : '▶'}
                                    </span>
                                </div>

                                {/* Sources */}
                                {nb.expanded && nb.sources.map(source => (
                                    <div
                                        key={source.id}
                                        title={source.name}
                                        onClick={() => toggleSourceSelection(nb.name, source.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '8px 12px 8px 32px',
                                            cursor: 'pointer',
                                            backgroundColor: source.selected ? '#1f1f3a' : 'transparent',
                                            fontSize: '14px',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={source.selected}
                                            onChange={() => { }}
                                            style={{ accentColor: '#8b5cf6', marginRight: '8px' }}
                                        />
                                        <span style={{ marginRight: '6px' }}>
                                            {source.type === 'website' ? '🔗' : source.type === 'file' ? '📄' : source.type === 'youtube' ? '📺' : '📋'}
                                        </span>
                                        <span
                                            title={source.name}
                                            style={{
                                                flex: 1,
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}
                                        >
                                            {source.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default SourceSelector;
