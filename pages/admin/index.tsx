// pages/admin/index.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const MCP_ENDPOINT = process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3005';

// Default pricing for MCP server endpoints
const DEFAULT_PRICING = {
    'POST /tools/query': { price: '0.01', description: 'Query knowledge base' },
    'POST /tools/add_website': { price: '0.05', description: 'Add website source' },
    'POST /tools/add_youtube': { price: '0.03', description: 'Add YouTube transcript' },
    'POST /tools/crawl_website': { price: '0.10', description: 'Crawl multi-page website' },
    'POST /tools/perplexity_search': { price: '0.02', description: 'Web search' },
    'POST /tools/add_file': { price: '0.01', perMB: '0.005', description: 'Add document' },
    'POST /tools/translate': { price: '0.01', description: 'Translate content' },
    'POST /tools/create_store': { price: '0.01', description: 'Create new notebook' },
    'POST /tools/list_stores': { price: '0.005', description: 'List notebooks' },
};

interface Transaction {
    id: string;
    amount: number;
    walletAddress: string;
    resource: string;
    status: string;
    createdAt: string;
}

interface MCPServer {
    id: string;
    name: string;
    url: string;
    adminWallet: string;
    merchantWallet: string;
    pricing: Record<string, { price: string; description: string; perMB?: string }>;
    paymentMode: 'USDC' | 'WEBAI' | 'BOTH';
    totalRevenue?: number;
    createdAt: string;
    _count?: { payments: number };
}

const AdminDashboard: React.FC = () => {
    const { ready, authenticated, login, logout, user } = usePrivy();
    const { wallets } = useWallets();

    // State
    const [servers, setServers] = useState<MCPServer[]>([]);
    const [newServerName, setNewServerName] = useState('');
    const [newServerUrl, setNewServerUrl] = useState('http://localhost:3005');
    const [expandedServer, setExpandedServer] = useState<string | null>(null);
    const [serverView, setServerView] = useState<'pricing' | 'transactions'>('pricing');
    const [serverTransactions, setServerTransactions] = useState<Record<string, Transaction[]>>({});
    const [serverStats, setServerStats] = useState<Record<string, { totalRevenue: number; totalTransactions: number }>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isPushing, setIsPushing] = useState<string | null>(null);

    // Get embedded wallet
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');

    // Load servers from database
    const loadServers = useCallback(async () => {
        if (!embeddedWallet) return;

        try {
            const res = await fetch(`${MCP_ENDPOINT}/admin/servers`, {
                headers: { 'X-Wallet-Address': embeddedWallet.address }
            });
            const data = await res.json();
            if (data.success) {
                setServers(data.servers);
            }
        } catch (e) {
            console.error('Failed to load servers:', e);
        }
    }, [embeddedWallet]);

    useEffect(() => {
        if (authenticated && embeddedWallet) {
            loadServers();
        }
    }, [authenticated, embeddedWallet, loadServers]);

    // Create new server
    const handleCreateServer = async () => {
        if (!newServerName.trim() || !newServerUrl.trim() || !embeddedWallet) {
            toast.error('Please enter server name and URL');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${MCP_ENDPOINT}/admin/servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newServerName.trim(),
                    url: newServerUrl.trim(),
                    adminWallet: embeddedWallet.address,
                    pricing: DEFAULT_PRICING,
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Server "${newServerName}" created!`);
                setNewServerName('');
                loadServers();
            } else {
                toast.error(data.error || 'Failed to create server');
            }
        } catch (e) {
            toast.error('Failed to create server');
        }
        setIsLoading(false);
    };

    // Delete server
    const handleDeleteServer = async (serverId: string, serverName: string) => {
        if (!confirm(`Delete server "${serverName}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`${MCP_ENDPOINT}/admin/servers/${serverId}`, {
                method: 'DELETE'
            });
            if ((await res.json()).success) {
                toast.success('Server deleted');
                loadServers();
            }
        } catch (e) {
            toast.error('Failed to delete server');
        }
    };

    // Update pricing for a server
    const handleUpdatePrice = async (serverId: string, path: string, newPrice: string) => {
        const server = servers.find(s => s.id === serverId);
        if (!server) return;

        const updatedPricing = {
            ...server.pricing,
            [path]: { ...server.pricing[path], price: newPrice }
        };

        try {
            await fetch(`${MCP_ENDPOINT}/admin/servers/${serverId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pricing: updatedPricing })
            });

            // Update local state
            setServers(prev => prev.map(s =>
                s.id === serverId ? { ...s, pricing: updatedPricing } : s
            ));
        } catch (e) {
            toast.error('Failed to update pricing');
        }
    };

    // Update payment mode for a server
    const handleUpdatePaymentMode = async (serverId: string, mode: 'USDC' | 'WEBAI' | 'BOTH') => {
        try {
            const res = await fetch(`${MCP_ENDPOINT}/admin/update-payment-mode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': embeddedWallet?.address || '',
                },
                body: JSON.stringify({ serverId, paymentMode: mode }),
            });
            const data = await res.json();
            if (data.success) {
                setServers(prev => prev.map(s =>
                    s.id === serverId ? { ...s, paymentMode: mode } : s
                ));
                toast.success(`Payment mode set to ${mode}`);
            } else {
                toast.error(data.error || 'Failed to update payment mode');
            }
        } catch (e) {
            toast.error('Failed to update payment mode');
        }
    };

    // Push config to MCP server
    const handlePushConfig = async (server: MCPServer) => {
        setIsPushing(server.id);
        try {
            // Convert pricing to the format expected by the server
            const pricingForServer: Record<string, any> = {};
            Object.entries(server.pricing).forEach(([key, value]) => {
                pricingForServer[key] = value;
            });

            const res = await fetch(`${server.url}/admin/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchantWallet: server.merchantWallet,
                    pricing: pricingForServer,
                })
            });

            if (res.ok) {
                toast.success(`Config pushed to ${server.name}!`);
            } else {
                toast.error('Failed to push config');
            }
        } catch (e) {
            toast.error('Failed to connect to server');
        }
        setIsPushing(null);
    };

    // Load transactions for a server
    const loadServerTransactions = async (serverId: string) => {
        try {
            const res = await fetch(`${MCP_ENDPOINT}/admin/servers/${serverId}/transactions`);
            const data = await res.json();
            if (data.success) {
                setServerTransactions(prev => ({ ...prev, [serverId]: data.transactions }));
                setServerStats(prev => ({ ...prev, [serverId]: data.stats }));
            }
        } catch (e) {
            console.error('Failed to load transactions:', e);
        }
    };

    // Toggle server expansion
    const toggleServer = (serverId: string) => {
        if (expandedServer === serverId) {
            setExpandedServer(null);
        } else {
            setExpandedServer(serverId);
            loadServerTransactions(serverId);
        }
    };

    // Format wallet address
    const formatAddress = (address: string) =>
        `${address.slice(0, 6)}...${address.slice(-4)}`;

    // Calculate totals
    const totalRevenue = Object.values(serverStats).reduce((sum, s) => sum + (s?.totalRevenue || 0), 0);
    const totalTransactions = Object.values(serverStats).reduce((sum, s) => sum + (s?.totalTransactions || 0), 0);

    if (!ready) {
        return (
            <div style={styles.container}>
                <div style={styles.loading}>Loading...</div>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div style={styles.container}>
                <div style={styles.loginCard}>
                    <h1 style={styles.title}>🔐 X402 Admin Dashboard</h1>
                    <p style={styles.subtitle}>Manage your MCP server payments with X402</p>
                    <button onClick={login} style={styles.loginButton}>
                        Sign in with Privy
                    </button>
                    <p style={styles.hint}>Sign in with Google, Twitter, Discord, or Email</p>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <ToastContainer position="top-right" theme="dark" />

            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerLeft}>
                    <h1 style={styles.title}>🔐 X402 Admin Dashboard</h1>
                </div>
                <div style={styles.headerRight}>
                    <div style={styles.networkBadge}>◆ Base Sepolia</div>
                    {embeddedWallet && (
                        <div style={styles.walletBadge}>
                            <span>💳</span>
                            <span>{formatAddress(embeddedWallet.address)}</span>
                        </div>
                    )}
                    <button onClick={logout} style={styles.logoutButton}>Logout</button>
                </div>
            </header>

            {/* Stats Row */}
            <div style={styles.statsRow}>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>${totalRevenue.toFixed(4)}</div>
                    <div style={styles.statLabel}>Total Revenue (USDC)</div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>{totalTransactions}</div>
                    <div style={styles.statLabel}>Total Transactions</div>
                </div>
                <div style={styles.statCard}>
                    <div style={styles.statValue}>{servers.length}</div>
                    <div style={styles.statLabel}>MCP Servers</div>
                </div>
            </div>

            {/* Create Server */}
            <div style={styles.createSection}>
                <h2 style={styles.sectionTitle}>MCP Servers</h2>
                <div style={styles.createServerRow}>
                    <input
                        type="text"
                        placeholder="Server name (e.g., gemini-file-search)"
                        value={newServerName}
                        onChange={(e) => setNewServerName(e.target.value)}
                        style={styles.input}
                    />
                    <input
                        type="text"
                        placeholder="Server URL"
                        value={newServerUrl}
                        onChange={(e) => setNewServerUrl(e.target.value)}
                        style={{ ...styles.input, maxWidth: '300px' }}
                    />
                    <button onClick={handleCreateServer} style={styles.createButton} disabled={isLoading}>
                        + Create Server
                    </button>
                </div>
            </div>

            {/* Server List */}
            <div style={styles.serverList}>
                {servers.length === 0 ? (
                    <div style={styles.emptyState}>
                        No servers yet. Create one above to get started.
                    </div>
                ) : (
                    servers.map(server => (
                        <div key={server.id} style={styles.serverCard}>
                            {/* Server Header */}
                            <div style={styles.serverHeader} onClick={() => toggleServer(server.id)}>
                                <div style={styles.serverInfo}>
                                    <div style={styles.serverName}>{server.name}</div>
                                    <div style={styles.serverMeta}>
                                        <span style={styles.serverUrl}>🌐 {server.url}</span>
                                        <span style={styles.serverWallet}>💳 {formatAddress(server.merchantWallet)}</span>
                                    </div>
                                </div>
                                <div style={styles.serverStats}>
                                    {/* Payment Mode Toggle */}
                                    <div style={{ display: 'flex', gap: '4px', marginRight: '15px' }}>
                                        {(['USDC', 'WEBAI', 'BOTH'] as const).map(mode => (
                                            <button
                                                key={mode}
                                                onClick={(e) => { e.stopPropagation(); handleUpdatePaymentMode(server.id, mode); }}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '0.7rem',
                                                    borderRadius: '4px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: server.paymentMode === mode ? (mode === 'USDC' ? '#3b82f6' : mode === 'WEBAI' ? '#10b981' : '#8b5cf6') : '#333',
                                                    color: server.paymentMode === mode ? '#fff' : '#888',
                                                }}
                                            >
                                                {mode}
                                            </button>
                                        ))}
                                    </div>
                                    <div style={styles.serverStatItem}>
                                        <span style={styles.serverStatValue}>
                                            ${(server.totalRevenue || 0).toFixed(4)}
                                        </span>
                                        <span style={styles.serverStatLabel}>Revenue</span>
                                    </div>
                                    <div style={styles.serverStatItem}>
                                        <span style={styles.serverStatValue}>
                                            {server._count?.payments || 0}
                                        </span>
                                        <span style={styles.serverStatLabel}>Payments</span>
                                    </div>
                                    <div style={styles.serverStatItem}>
                                        <span style={styles.serverStatValue}>
                                            {Object.keys(server.pricing).length}
                                        </span>
                                        <span style={styles.serverStatLabel}>Endpoints</span>
                                    </div>
                                </div>
                                <div style={styles.serverActions}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            window.open(`https://sepolia.basescan.org/address/${server.merchantWallet}`, '_blank');
                                        }}
                                        style={{ ...styles.pushButton, backgroundColor: '#3b82f6', marginRight: '8px' }}
                                    >
                                        📜 Tx
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePushConfig(server); }}
                                        style={styles.pushButton}
                                        disabled={isPushing === server.id}
                                    >
                                        {isPushing === server.id ? '⏳' : '🚀'} Push Config
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteServer(server.id, server.name); }}
                                        style={styles.deleteButton}
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedServer === server.id && (
                                <div style={styles.expandedContent}>
                                    {/* Sub-tabs */}
                                    <div style={styles.subTabs}>
                                        <button
                                            onClick={() => setServerView('pricing')}
                                            style={{
                                                ...styles.subTab,
                                                ...(serverView === 'pricing' ? styles.activeSubTab : {})
                                            }}
                                        >
                                            💰 Pricing
                                        </button>
                                        <button
                                            onClick={() => setServerView('transactions')}
                                            style={{
                                                ...styles.subTab,
                                                ...(serverView === 'transactions' ? styles.activeSubTab : {})
                                            }}
                                        >
                                            📊 Transactions
                                        </button>
                                    </div>

                                    {/* Pricing Table */}
                                    {serverView === 'pricing' && (
                                        <div style={styles.pricingTable}>
                                            <div style={styles.pricingHeader}>
                                                <div style={styles.pricingCell}>Endpoint</div>
                                                <div style={styles.pricingCell}>Description</div>
                                                <div style={styles.pricingCell}>Price (USDC)</div>
                                            </div>
                                            {Object.entries(server.pricing).map(([path, config]) => (
                                                <div key={path} style={styles.pricingRow}>
                                                    <div style={styles.pricingCell}>
                                                        <code style={styles.endpointCode}>{path}</code>
                                                    </div>
                                                    <div style={styles.pricingCell}>{config.description}</div>
                                                    <div style={styles.pricingCell}>
                                                        <input
                                                            type="number"
                                                            step="0.001"
                                                            min="0"
                                                            value={config.price}
                                                            onChange={(e) => handleUpdatePrice(server.id, path, e.target.value)}
                                                            style={styles.priceInput}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Transactions List */}
                                    {serverView === 'transactions' && (
                                        <div>
                                            {!serverTransactions[server.id]?.length ? (
                                                <div style={styles.emptyState}>
                                                    No transactions yet for this server.
                                                </div>
                                            ) : (
                                                <div style={styles.transactionTable}>
                                                    <div style={styles.transactionHeader}>
                                                        <div style={styles.txCell}>Time</div>
                                                        <div style={styles.txCell}>From</div>
                                                        <div style={styles.txCell}>Endpoint</div>
                                                        <div style={styles.txCell}>Amount</div>
                                                        <div style={styles.txCell}>Status</div>
                                                    </div>
                                                    {serverTransactions[server.id].map(tx => (
                                                        <div key={tx.id} style={styles.transactionRow}>
                                                            <div style={styles.txCell}>
                                                                {new Date(tx.createdAt).toLocaleString()}
                                                            </div>
                                                            <div style={styles.txCell}>{formatAddress(tx.walletAddress)}</div>
                                                            <div style={styles.txCell}>
                                                                <code style={styles.endpointCode}>{tx.resource}</code>
                                                            </div>
                                                            <div style={styles.txCell}>${Number(tx.amount).toFixed(4)}</div>
                                                            <div style={styles.txCell}>
                                                                <span style={{
                                                                    ...styles.statusBadge,
                                                                    backgroundColor: tx.status === 'verified' ? '#10b981' : '#f59e0b',
                                                                }}>
                                                                    {tx.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// Styles
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#0f0f0f',
        color: '#fff',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    loading: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem',
    },
    loginCard: {
        maxWidth: '400px',
        margin: '100px auto',
        padding: '40px',
        backgroundColor: '#1a1a1a',
        borderRadius: '16px',
        textAlign: 'center',
        border: '1px solid #333',
    },
    title: {
        fontSize: '1.8rem',
        marginBottom: '10px',
        color: '#fff',
    },
    subtitle: {
        color: '#888',
        marginBottom: '30px',
    },
    loginButton: {
        width: '100%',
        padding: '14px',
        backgroundColor: '#7c3aed',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: 600,
        cursor: 'pointer',
    },
    hint: {
        marginTop: '15px',
        color: '#666',
        fontSize: '0.85rem',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '1px solid #333',
    },
    headerLeft: {},
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
    },
    networkBadge: {
        padding: '8px 16px',
        backgroundColor: '#1a3a5c',
        borderRadius: '8px',
        fontSize: '0.9rem',
        color: '#60a5fa',
    },
    walletBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        fontSize: '0.9rem',
    },
    logoutButton: {
        padding: '8px 16px',
        backgroundColor: 'transparent',
        color: '#888',
        border: '1px solid #333',
        borderRadius: '8px',
        cursor: 'pointer',
    },
    statsRow: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px',
        marginBottom: '30px',
    },
    statCard: {
        padding: '24px',
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333',
        textAlign: 'center',
    },
    statValue: {
        fontSize: '2rem',
        fontWeight: 700,
        color: '#7c3aed',
        marginBottom: '8px',
    },
    statLabel: {
        color: '#888',
        fontSize: '0.9rem',
    },
    createSection: {
        marginBottom: '20px',
    },
    sectionTitle: {
        fontSize: '1.3rem',
        marginBottom: '15px',
        color: '#fff',
    },
    createServerRow: {
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
    },
    input: {
        flex: 1,
        padding: '12px 16px',
        backgroundColor: '#0f0f0f',
        border: '1px solid #333',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '0.95rem',
    },
    createButton: {
        padding: '12px 24px',
        backgroundColor: '#10b981',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 600,
        whiteSpace: 'nowrap',
    },
    serverList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '15px',
    },
    serverCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333',
        overflow: 'hidden',
    },
    serverHeader: {
        display: 'flex',
        alignItems: 'center',
        padding: '20px',
        cursor: 'pointer',
        gap: '20px',
    },
    serverInfo: {
        flex: 1,
    },
    serverName: {
        fontSize: '1.2rem',
        fontWeight: 600,
        marginBottom: '6px',
    },
    serverMeta: {
        display: 'flex',
        gap: '20px',
        fontSize: '0.85rem',
        color: '#888',
    },
    serverUrl: {
        color: '#60a5fa',
    },
    serverWallet: {},
    serverStats: {
        display: 'flex',
        gap: '30px',
    },
    serverStatItem: {
        textAlign: 'center',
    },
    serverStatValue: {
        display: 'block',
        fontSize: '1.1rem',
        fontWeight: 600,
        color: '#10b981',
    },
    serverStatLabel: {
        fontSize: '0.75rem',
        color: '#666',
    },
    serverActions: {
        display: 'flex',
        gap: '10px',
    },
    pushButton: {
        padding: '8px 16px',
        backgroundColor: '#7c3aed',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.85rem',
    },
    deleteButton: {
        padding: '8px 12px',
        backgroundColor: 'transparent',
        color: '#666',
        border: '1px solid #333',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '1.1rem',
    },
    expandedContent: {
        borderTop: '1px solid #333',
        padding: '20px',
        backgroundColor: '#0f0f0f',
    },
    subTabs: {
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
    },
    subTab: {
        padding: '8px 16px',
        backgroundColor: 'transparent',
        color: '#888',
        border: '1px solid #333',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.9rem',
    },
    activeSubTab: {
        backgroundColor: '#333',
        color: '#fff',
        borderColor: '#555',
    },
    pricingTable: {
        border: '1px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    pricingHeader: {
        display: 'grid',
        gridTemplateColumns: '2fr 2fr 1fr',
        backgroundColor: '#1a1a1a',
        padding: '12px 16px',
        fontWeight: 600,
        borderBottom: '1px solid #333',
    },
    pricingRow: {
        display: 'grid',
        gridTemplateColumns: '2fr 2fr 1fr',
        padding: '12px 16px',
        borderBottom: '1px solid #222',
        alignItems: 'center',
    },
    pricingCell: {
        padding: '4px 0',
    },
    endpointCode: {
        backgroundColor: '#1a1a1a',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '0.8rem',
        color: '#10b981',
    },
    priceInput: {
        width: '100px',
        padding: '8px 12px',
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '0.9rem',
    },
    transactionTable: {
        border: '1px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    transactionHeader: {
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 2fr 1fr 1fr',
        backgroundColor: '#1a1a1a',
        padding: '12px 16px',
        fontWeight: 600,
        borderBottom: '1px solid #333',
    },
    transactionRow: {
        display: 'grid',
        gridTemplateColumns: '2fr 1.5fr 2fr 1fr 1fr',
        padding: '12px 16px',
        borderBottom: '1px solid #222',
        alignItems: 'center',
    },
    txCell: {
        padding: '4px 0',
        fontSize: '0.9rem',
    },
    statusBadge: {
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: 500,
        color: '#fff',
    },
    emptyState: {
        padding: '40px',
        textAlign: 'center',
        color: '#666',
    },
};

export default AdminDashboard;
