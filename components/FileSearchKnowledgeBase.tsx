/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import ReactMarkdown from 'react-markdown';
import { useLocalizedString } from '../util/LocalizedText';
import { useSmartFetch } from '../hooks/useSmartFetch';
import { ethers } from 'ethers';
import { ACTIVE_CHAIN, WEBAI_TOKEN_ADDRESS } from '../constants/constants';

// RPC URLs for different chains (no thirdweb dependency)
const RPC_URLS: { [key: string]: string } = {
    baseSepolia: 'https://sepolia.base.org',
    base: 'https://mainnet.base.org',
};

// Define the minimal ERC-20 ABI (same as Navbar)
const erc20Abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
];

const MCP_ENDPOINT = process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3005';

interface Source {
    id: string;
    name: string;
    type: string;
    url?: string;
    selected: boolean;
    notebookId?: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    queryId?: string;
    fromCache?: boolean;
    feedbackGiven?: 'up' | 'down' | 'edited';
    isEditing?: boolean;
    editText?: string;
}

interface Notebook {
    name: string;
    displayName: string;
    sourceCount: number;
    sources: Source[];
    expanded: boolean;
}

interface FileSearchKnowledgeBaseProps {
    userKey: string;
    onClose: () => void;
    onSourcesSelected?: (sources: Source[]) => void;
}

type AddSourceTab = 'web_search' | 'file' | 'website' | 'youtube' | 'text' | 'github' | 'gdrive';

const FileSearchKnowledgeBase: React.FC<FileSearchKnowledgeBaseProps> = ({
    userKey,
    onClose,
    onSourcesSelected,
}) => {
    const { smartFetch: x402Fetch, isReady: x402Ready, isAdminMode, userWallet: connectedWallet } = useSmartFetch();

    // Prefer connected wallet (verified 0x address) over prop userKey (which might be Privy ID)
    const activeWallet = connectedWallet || userKey;

    // Debug: Log x402 status on mount
    console.log('🔷 FileSearchKnowledgeBase: x402Ready=', x402Ready, 'x402Fetch type=', typeof x402Fetch);

    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [selectedNotebook, setSelectedNotebook] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNotebookName, setNewNotebookName] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected'>('disconnected');
    const [showAddModal, setShowAddModal] = useState(false);

    // Balance display state
    const [usdBalance, setUsdBalance] = useState<number | null>(null);
    const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AddSourceTab>('web_search');
    const [question, setQuestion] = useState('');

    // Localized strings
    const onlineText = useLocalizedString('Online');
    const offlineText = useLocalizedString('Offline');
    const createNotebookText = useLocalizedString('+ Create notebook');
    const chatText = useLocalizedString('Chat');
    const startTypingText = useLocalizedString('Start typing...');
    const askQuestionsText = useLocalizedString('Ask questions about your selected sources');
    const aiLearnsText = useLocalizedString('AI learns from your feedback');
    const sourcesText = useLocalizedString('sources');
    const loadingText = useLocalizedString('Loading...');
    const noNotebooksText = useLocalizedString('No notebooks yet.');
    const clickCreateText = useLocalizedString('Click "+ Create notebook" to start.');
    const knowledgeBaseText = useLocalizedString('Knowledge Base');
    const cachedText = useLocalizedString('cached');

    // Add source form state
    const [modalUrl, setModalUrl] = useState('');
    const [modalText, setModalText] = useState('');
    const [modalTextName, setModalTextName] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [enableCrawl, setEnableCrawl] = useState(false);
    const [maxPages, setMaxPages] = useState(10);
    const [crawlProgress, setCrawlProgress] = useState('');

    // OAuth state
    const [connections, setConnections] = useState<{ provider: string, accountName: string }[]>([]);
    const [forceOAuthConnected, setForceOAuthConnected] = useState<string>(''); // Track which provider just connected via OAuth
    const [githubRepos, setGithubRepos] = useState<any[]>([]);
    const [selectedRepo, setSelectedRepo] = useState('');
    const [repoFiles, setRepoFiles] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [driveFiles, setDriveFiles] = useState<any[]>([]);
    const [driveFolderId, setDriveFolderId] = useState('root');
    const [driveFolderStack, setDriveFolderStack] = useState<{ id: string, name: string }[]>([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);

    // Web Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ content: string, citations: string[] } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchMode, setSearchMode] = useState<'fast' | 'deep'>('fast');
    const [selectedCitations, setSelectedCitations] = useState<string[]>([]);

    // Auth session for login-required sites
    const [requiresLogin, setRequiresLogin] = useState(false);
    const [authSessionId, setAuthSessionId] = useState('');
    const [authStatus, setAuthStatus] = useState<'idle' | 'waiting' | 'ready'>('idle');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        checkServerStatus();

        // Only load notebooks when X402 is ready (wallet connected) AND we have a valid activeWallet
        // This ensures the X402 fetch wrapper can handle payments and we have a wallet to query
        if (x402Ready && activeWallet) {
            console.log('🔷 FileSearchKnowledgeBase: x402Ready=true, activeWallet=', activeWallet, ', calling refreshNotebooks');
            refreshNotebooks();
        } else {
            console.log('🔷 FileSearchKnowledgeBase: waiting for x402Ready or activeWallet...', { x402Ready, activeWallet });
        }

        // Check for OAuth callback parameters in URL
        const urlParams = new URLSearchParams(window.location.search);
        const connected = urlParams.get('connected');

        // Fetch connections first, then handle OAuth callback
        const handleOAuthCallback = async () => {
            await fetchConnections();

            if (connected === 'github') {
                setForceOAuthConnected('github'); // Force connected state before async update
                setShowAddModal(true);
                setActiveTab('github');
                fetchGithubRepos();
                // Clean up URL but preserve userKey
                const newUrl = window.location.pathname + (urlParams.get('userKey') ? `?userKey=${urlParams.get('userKey')}` : '');
                window.history.replaceState({}, '', newUrl);
            } else if (connected === 'google') {
                setForceOAuthConnected('google'); // Force connected state before async update
                setShowAddModal(true);
                setActiveTab('gdrive');
                fetchDriveFiles('root');
                // Clean up URL but preserve userKey
                const newUrl = window.location.pathname + (urlParams.get('userKey') ? `?userKey=${urlParams.get('userKey')}` : '');
                window.history.replaceState({}, '', newUrl);
            }
        };

        handleOAuthCallback();

        const interval = setInterval(checkServerStatus, 30000);
        return () => clearInterval(interval);
    }, [x402Ready, activeWallet]); // Re-run when x402 becomes ready OR activeWallet changes

    // Fetch balances (same pattern as Navbar)
    const fetchBalances = async () => {
        // Use the same userAddress from localStorage that the navbar uses
        const userAddress = typeof window !== 'undefined' ? localStorage.getItem('userAddress') : null;
        const walletToUse = userAddress || activeWallet;
        if (!walletToUse) return;
        try {
            // Fetch USD balance using SAME API as navbar's handleRefreshFreeChats
            const res = await fetch('/api/get-free-trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: walletToUse }),
            });
            if (res.ok) {
                const data = await res.json();
                setUsdBalance(data.freeTrades ?? 0);
            }

            // Fetch USDC balance from blockchain
            const rpcUrl = RPC_URLS[ACTIVE_CHAIN] || 'https://sepolia.base.org';
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const erc20Contract = new ethers.Contract(WEBAI_TOKEN_ADDRESS, erc20Abi, provider);
            const balance = await erc20Contract.balanceOf(walletToUse);
            const decimals = await erc20Contract.decimals();
            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            setUsdcBalance(parseFloat(formattedBalance).toFixed(3));
        } catch (e) { console.error('Error fetching balances:', e); }
    };

    // Poll balances every 30 seconds
    useEffect(() => {
        if (!activeWallet) return;
        fetchBalances(); // Initial fetch
        const interval = setInterval(fetchBalances, 30000);
        return () => clearInterval(interval);
    }, [activeWallet]);

    // Listen for refresh events
    useEffect(() => {
        const handleRefresh = () => fetchBalances();
        window.addEventListener('refreshBalance', handleRefresh);
        window.addEventListener('refreshFreeChats', handleRefresh);
        window.addEventListener('refreshWebaiCredits', handleRefresh);
        return () => {
            window.removeEventListener('refreshBalance', handleRefresh);
            window.removeEventListener('refreshFreeChats', handleRefresh);
            window.removeEventListener('refreshWebaiCredits', handleRefresh);
        };
    }, [activeWallet]);

    const checkServerStatus = async () => {
        try {
            const res = await fetch(`${MCP_ENDPOINT}/health`);
            setServerStatus(res.ok ? 'connected' : 'disconnected');
        } catch { setServerStatus('disconnected'); }
    };

    const fetchConnections = async () => {
        try {
            const res = await fetch(`${MCP_ENDPOINT}/auth/connections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': userKey },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.success) setConnections(data.connections || []);
        } catch (e) { console.error(e); }
    };

    const isConnected = (provider: string) => {
        // Check forceOAuthConnected for when OAuth just completed (before connections state updates)
        if (forceOAuthConnected === provider || (provider === 'gdrive' && forceOAuthConnected === 'google')) {
            return true;
        }
        return connections.some(c => c.provider === provider || (provider === 'gdrive' && c.provider === 'google'));
    };

    const startOAuth = (provider: string) => {
        // Map 'gdrive' to 'google' for the OAuth endpoint
        const oauthProvider = provider === 'gdrive' ? 'google' : provider;
        const returnUrl = encodeURIComponent(window.location.href);
        const url = `${MCP_ENDPOINT}/auth/${oauthProvider}?userWallet=${userKey}&returnUrl=${returnUrl}`;
        window.location.href = url;
    };

    const fetchGithubRepos = async () => {
        try {
            const res = await fetch(`${MCP_ENDPOINT}/tools/list_github_repos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': userKey },
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.success) setGithubRepos(data.repos || []);
        } catch (e) { console.error(e); }
    };

    const fetchRepoFiles = async (repo: string) => {
        try {
            const res = await fetch(`${MCP_ENDPOINT}/tools/list_repo_files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': userKey },
                body: JSON.stringify({ repo }),
            });
            const data = await res.json();
            if (data.success) setRepoFiles(data.files || []);
        } catch (e) { console.error(e); }
    };

    const addGithubFile = async (repo: string, path: string) => {
        if (!selectedNotebook) { toast.warning('Select a notebook first'); return; }
        setIsProcessing(true);
        try {
            const res = await fetch(`${MCP_ENDPOINT}/tools/add_github_source`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': userKey },
                body: JSON.stringify({ storeName: selectedNotebook, repo, path }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('File added!');
                await refreshNotebooks();
            } else toast.error(data.error || 'Failed');
        } catch (e) { toast.error('Failed'); }
        finally { setIsProcessing(false); }
    };

    const fetchDriveFiles = async (folderId: string) => {
        setIsLoadingFiles(true);
        try {
            const res = await fetch(`${MCP_ENDPOINT}/drive/files?folderId=${folderId}`, {
                headers: { 'X-Wallet-Address': userKey },
            });
            const data = await res.json();
            if (data.success) {
                setDriveFiles(data.files || []);
                setDriveFolderId(folderId);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoadingFiles(false); }
    };

    const navigateToFolder = (folderId: string, folderName: string) => {
        // Save current folder to stack before navigating
        setDriveFolderStack(prev => [...prev, { id: driveFolderId, name: folderName }]);
        fetchDriveFiles(folderId);
    };

    const navigateBackFolder = () => {
        if (driveFolderStack.length > 0) {
            const stack = [...driveFolderStack];
            const parent = stack.pop();
            setDriveFolderStack(stack);
            fetchDriveFiles(parent?.id || 'root');
        } else {
            fetchDriveFiles('root');
        }
    };

    const addDriveFile = async (fileId: string, fileName: string) => {
        if (!selectedNotebook) { toast.warning('Select a notebook first'); return; }
        setIsProcessing(true);
        try {
            console.log('Adding Drive file:', { storeName: selectedNotebook, fileId, fileName, userKey });
            const res = await fetch(`${MCP_ENDPOINT}/tools/add_drive_source`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Wallet-Address': userKey },
                body: JSON.stringify({ storeName: selectedNotebook, fileId, fileName }),
            });
            const data = await res.json();
            console.log('Drive file response:', data);
            if (data.success) {
                toast.success('File added from Drive!');
                await refreshNotebooks();
            } else {
                toast.error(data.error || 'Failed to add file');
                console.error('Drive file error:', data.error);
            }
        } catch (e) {
            console.error('Drive file exception:', e);
            toast.error('Failed to add file');
        }
        finally { setIsProcessing(false); }
    };

    const refreshNotebooks = async () => {
        console.log('[KB] Refreshing notebooks...');
        try {
            setIsLoading(true);
            setIsLoading(true);
            console.log(`[KB] Fetching from ${MCP_ENDPOINT}/tools/list_stores with userWallet=${activeWallet}`);
            const res = await x402Fetch(`${MCP_ENDPOINT}/tools/list_stores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userWallet: activeWallet }),
            });
            const data = await res.json();
            console.log('[KB] list_stores response:', data);
            if (data.success) {
                const notebookList = data.stores || [];
                const notebooksWithSources: Notebook[] = [];
                for (const nb of notebookList) {
                    try {
                        const sourcesRes = await x402Fetch(`${MCP_ENDPOINT}/tools/list_sources`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ storeName: nb.name }),
                        });
                        if (sourcesRes.ok) {
                            const sourcesData = await sourcesRes.json();
                            notebooksWithSources.push({
                                ...nb,
                                sources: (sourcesData.sources || []).map((s: any) => ({
                                    ...s,
                                    selected: s.isSelected ?? true,
                                    notebookId: nb.name,
                                })),
                                expanded: notebooks.find(n => n.name === nb.name)?.expanded ?? true,
                            });
                        } else {
                            // If list_sources fails (e.g. 402 payment required but user cancelled), push notebook without sources
                            notebooksWithSources.push({ ...nb, sources: [], expanded: false });
                        }
                    } catch (err) {
                        console.warn(`Failed to list sources for notebook ${nb.name}:`, err);
                        // Still show notebook even if sources fail
                        notebooksWithSources.push({ ...nb, sources: [], expanded: false });
                    }
                }
                setNotebooks(notebooksWithSources);
                if (!selectedNotebook && notebooksWithSources.length > 0) {
                    setSelectedNotebook(notebooksWithSources[0].name);
                }
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const createNotebook = async () => {
        if (!newNotebookName.trim()) { toast.warning('Enter a name'); return; }
        try {
            // Use x402Fetch because create_store requires payment (0.01 USDC)
            const res = await x402Fetch(`${MCP_ENDPOINT}/tools/create_store`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newNotebookName, userWallet: activeWallet }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Notebook created!');
                await refreshNotebooks();
                setSelectedNotebook(data.store.name);
                setNewNotebookName('');
                setShowCreateModal(false);
            } else toast.error(data.error);
        } catch (e) { toast.error('Failed'); }
    };

    const deleteNotebook = async (notebookName: string) => {
        const nb = notebooks.find(n => n.name === notebookName);
        if (nb && nb.sources.length > 0) {
            toast.warning('Delete all sources first');
            return;
        }
        if (!window.confirm(`Delete notebook "${nb?.displayName || notebookName}"?`)) return;
        try {
            console.log('Deleting notebook:', notebookName);
            const res = await fetch(`${MCP_ENDPOINT}/tools/delete_store`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeName: notebookName }),
            });
            const data = await res.json();
            console.log('Delete response:', data);
            if (data.success) {
                toast.success('Notebook deleted!');
                if (selectedNotebook === notebookName) {
                    setSelectedNotebook('');
                }
                await refreshNotebooks();
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch (e: any) {
            console.error('Delete error:', e);
            toast.error('Failed to delete: ' + e.message);
        }
    };

    const toggleNotebookExpand = (name: string) => {
        setNotebooks(prev => prev.map(nb =>
            nb.name === name ? { ...nb, expanded: !nb.expanded } : nb
        ));
    };

    const toggleSource = async (sourceId: string, notebookName: string) => {
        setNotebooks(prev => prev.map(nb => ({
            ...nb,
            sources: nb.sources.map(s =>
                s.id === sourceId ? { ...s, selected: !s.selected } : s
            ),
        })));
        try {
            const nb = notebooks.find(n => n.name === notebookName);
            const source = nb?.sources.find(s => s.id === sourceId);
            await fetch(`${MCP_ENDPOINT}/tools/toggle_source_selection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceId, isSelected: !source?.selected }),
            });
        } catch (e) { console.error(e); }
    };

    const deleteSource = async (sourceId: string, notebookName: string) => {
        try {
            const res = await fetch(`${MCP_ENDPOINT}/tools/delete_source`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeName: notebookName, sourceId }),
            });
            if ((await res.json()).success) {
                toast.success('Deleted');
                await refreshNotebooks();
            }
        } catch (e) { toast.error('Failed'); }
    };

    // Auth session functions for login-required websites
    const startAuthSession = async () => {
        if (!modalUrl.trim()) return;
        setIsProcessing(true);
        setAuthStatus('waiting');
        try {
            const res = await fetch(`${MCP_ENDPOINT}/tools/start_auth_session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loginUrl: modalUrl }),
            });
            const data = await res.json();
            if (data.success) {
                setAuthSessionId(data.sessionId);
                setAuthStatus('ready');
                toast.info('Browser opened! Log in, then click "Scrape After Login"');
            } else {
                toast.error(data.error || 'Failed to start auth session');
                setAuthStatus('idle');
            }
        } catch (e) { console.error(e); setAuthStatus('idle'); }
        setIsProcessing(false);
    };

    const completeAuthScrape = async () => {
        if (!authSessionId || !selectedNotebook) return;
        setIsProcessing(true);
        try {
            const endpoint = enableCrawl ? '/tools/complete_auth_crawl' : '/tools/complete_auth_scrape';
            const body = enableCrawl
                ? { sessionId: authSessionId, storeName: selectedNotebook, maxPages, maxDepth: 2 }
                : { sessionId: authSessionId, storeName: selectedNotebook };

            if (enableCrawl) setCrawlProgress('🔐 Crawling after login...');

            const res = await fetch(`${MCP_ENDPOINT}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                if (enableCrawl) {
                    setCrawlProgress(`✅ Crawled ${data.source?.pagesCrawled || 0} pages`);
                } else {
                    toast.success('Page scraped successfully!');
                }
                await refreshNotebooks();
                setTimeout(() => { setShowAddModal(false); resetModal(); }, 1000);
            } else {
                setCrawlProgress(`❌ ${data.error}`);
                toast.error(data.error || 'Failed');
            }
        } catch (e) { toast.error('Failed'); }
        finally { setIsProcessing(false); }
    };

    const cancelAuthSession = async () => {
        if (authSessionId) {
            try {
                await fetch(`${MCP_ENDPOINT}/tools/cancel_auth_session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: authSessionId }),
                });
            } catch (e) { console.error(e); }
        }
        setAuthSessionId('');
        setAuthStatus('idle');
    };

    const handleAddWebsite = async () => {
        if (!modalUrl || !selectedNotebook) return;

        // If requires login and not yet authenticated
        if (requiresLogin && authStatus === 'idle') {
            await startAuthSession();
            return;
        }

        // If authenticated, use authenticated endpoints
        if (requiresLogin && authStatus === 'ready') {
            await completeAuthScrape();
            return;
        }

        // Normal website (no login required)
        setIsProcessing(true);
        setCrawlProgress('');
        try {
            if (enableCrawl) {
                setCrawlProgress('🕸️ Crawling...');
                const res = await x402Fetch(`${MCP_ENDPOINT}/tools/crawl_website`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeName: selectedNotebook, url: modalUrl, maxPages, maxDepth: 2 }),
                });
                const data = await res.json();
                if (data.success) {
                    setCrawlProgress(`✅ ${data.source?.pagesCrawled || 0} pages crawled into 1 source`);
                    await refreshNotebooks();
                    setTimeout(() => { setShowAddModal(false); resetModal(); }, 1500);
                } else setCrawlProgress(`❌ ${data.error}`);
            } else {
                const res = await x402Fetch(`${MCP_ENDPOINT}/tools/add_website`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeName: selectedNotebook, url: modalUrl }),
                });
                const data = await res.json();
                if (data.success) {
                    toast.success('Website added!');
                    await refreshNotebooks();
                    setShowAddModal(false);
                    resetModal();
                } else toast.error(data.error || 'Failed');
            }
        } catch (e) { toast.error('Failed'); }
        finally { setIsProcessing(false); }
    };

    const handleAddYouTube = async () => {
        if (!modalUrl || !selectedNotebook) return;
        setIsProcessing(true);
        try {
            const res = await x402Fetch(`${MCP_ENDPOINT}/tools/add_youtube`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeName: selectedNotebook, url: modalUrl }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('YouTube video added!');
                await refreshNotebooks();
                setShowAddModal(false);
                resetModal();
            } else toast.error(data.error || 'Failed to add YouTube video');
        } catch (e) { toast.error('Failed'); }
        finally { setIsProcessing(false); }
    };

    const handleAddText = async () => {
        if (!modalText || !modalTextName || !selectedNotebook) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`${MCP_ENDPOINT}/tools/add_text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeName: selectedNotebook, title: modalTextName, content: modalText }),
            });
            if ((await res.json()).success) {
                toast.success('Added!');
                await refreshNotebooks();
                setShowAddModal(false);
                resetModal();
            }
        } catch (e) { toast.error('Failed'); }
        finally { setIsProcessing(false); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) {
            toast.warning('No file selected');
            return;
        }
        if (!selectedNotebook) {
            toast.warning('Select a notebook first');
            return;
        }

        // Allowed text-based file extensions
        const allowedExtensions = ['.txt', '.md', '.json', '.csv', '.xml', '.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.yml', '.yaml', '.ini', '.conf', '.log'];

        setIsProcessing(true);
        let successCount = 0;
        for (const file of Array.from(files)) {
            try {
                const ext = '.' + file.name.split('.').pop()?.toLowerCase();
                const binaryExtensions = [
                    // Documents
                    '.pdf', '.docx', '.pptx', '.doc', '.ppt', '.xlsx', '.xls',
                    // Images
                    '.png', '.jpg', '.jpeg', '.gif', '.webp',
                    // Audio
                    '.mp3', '.wav', '.flac',
                    // Video
                    '.mp4', '.mpeg', '.mov', '.flv'
                ];
                const isBinary = binaryExtensions.includes(ext);

                console.log('Uploading file:', file.name, 'to notebook:', selectedNotebook, isBinary ? '(binary)' : '(text)');
                console.log(`File size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

                let payload: any = { storeName: selectedNotebook, fileName: file.name };

                if (isBinary) {
                    // Read as base64 for binary files (PDFs, images, etc.)
                    // Use chunked approach to avoid "Maximum call stack size exceeded" error
                    // (spread operator on large arrays overflows the stack)
                    console.log('Reading binary file as base64...');
                    const buffer = await file.arrayBuffer();
                    const uint8Array = new Uint8Array(buffer);
                    let binaryString = '';
                    const chunkSize = 32768; // Process in 32KB chunks
                    for (let i = 0; i < uint8Array.length; i += chunkSize) {
                        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                        binaryString += String.fromCharCode.apply(null, chunk as any);
                    }
                    const base64 = btoa(binaryString);
                    payload.fileBase64 = base64;
                    payload.mimeType = file.type;
                    console.log(`Base64 length: ${base64.length} chars (${(base64.length / 1024 / 1024).toFixed(2)} MB)`);
                } else {
                    // Read as text for text files
                    let content = '';
                    try {
                        content = await file.text();
                        content = content.replace(/\0/g, '');
                    } catch (readError) {
                        toast.error(`Cannot read file: ${file.name}`);
                        continue;
                    }

                    if (!content.trim()) {
                        toast.error(`File is empty: ${file.name}`);
                        continue;
                    }
                    payload.content = content;
                }

                // Estimate payload size
                const payloadStr = JSON.stringify(payload);
                const payloadSizeMB = (payloadStr.length / 1024 / 1024).toFixed(2);
                console.log(`Payload size: ${payloadSizeMB} MB`);
                console.log(`Payload size: ${payloadSizeMB} MB`);
                console.log(`Sending to: ${MCP_ENDPOINT}/tools/add_file`);

                // Use X402 fetch wrapper for payment handling
                const res = await x402Fetch(`${MCP_ENDPOINT}/tools/add_file`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payloadStr,
                });
                console.log('Fetch completed, status:', res.status);
                const data = await res.json();
                console.log('Upload response:', data);
                if (data.success) {
                    successCount++;
                    if (data.useFileSearch) {
                        toast.info(`${file.name} uploaded to File Search Store`);
                    }
                } else {
                    toast.error(`Failed: ${file.name} - ${data.error}`);
                }
            } catch (err: any) {
                console.error('Upload error:', err);
                console.error('Error name:', err.name);
                console.error('Error stack:', err.stack);
                // More specific error message
                if (err.message.includes('NetworkError') || err.name === 'TypeError') {
                    toast.error(`Network error uploading ${file.name}. Check if MCP server (localhost:3005) is running and not crashed.`);
                } else {
                    toast.error(`Error: ${file.name} - ${err.message}`);
                }
            }
        }
        if (successCount > 0) {
            toast.success(`Uploaded ${successCount} file(s)!`);
        }
        await refreshNotebooks();
        setIsProcessing(false);
        e.target.value = '';
        setShowAddModal(false);
    };

    const resetModal = () => {
        setModalUrl(''); setModalText(''); setModalTextName('');
        setSelectedFile(null); setEnableCrawl(false); setCrawlProgress('');
        setRequiresLogin(false); setAuthSessionId(''); setAuthStatus('idle');
        setSearchQuery(''); setSearchResults(null); setSelectedCitations([]); setIsSearching(false);
    };

    const handleWebSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setSearchResults(null);
        setSelectedCitations([]);
        try {
            const res = await x402Fetch(`${MCP_ENDPOINT}/tools/perplexity_search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery, mode: searchMode }),
            });
            const data = await res.json();
            if (data.success) {
                setSearchResults({ content: data.content, citations: data.citations });
            } else {
                toast.error(data.error || 'Search failed');
            }
        } catch (e) {
            console.error(e);
            toast.error('Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddCitations = async () => {
        if (selectedCitations.length === 0 || !selectedNotebook) return;

        setIsProcessing(true);
        let addedCount = 0;

        // Use sequential execution to allow toast updates or progress showing if we wanted, 
        // but mainly to not overwhelm the server if many sources
        for (const url of selectedCitations) {
            try {
                const res = await x402Fetch(`${MCP_ENDPOINT}/tools/add_website`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeName: selectedNotebook, url: url }),
                });
                const data = await res.json();
                if (data.success) addedCount++;
            } catch (e) {
                console.error(`Failed to add ${url}`, e);
            }
        }

        if (addedCount > 0) {
            toast.success(`Added ${addedCount} sources!`);
            await refreshNotebooks();
            setShowAddModal(false);
            resetModal();
        } else {
            toast.error('Failed to add sources');
        }
        setIsProcessing(false);
    };

    const handleQuery = async () => {
        const allSources = notebooks.flatMap(nb => nb.sources);
        const selectedSources = allSources.filter(s => s.selected);
        if (selectedSources.length === 0) { toast.warning('Select sources first'); return; }
        if (!question.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: question };
        setMessages(prev => [...prev, userMsg]);
        setQuestion('');
        setIsProcessing(true);

        try {
            // Detect translation requests with more flexible patterns
            const translateMatch = question.match(/translat(?:e|ion)?.*?(?:to|into|in)\s+(\w+)/i) ||
                question.match(/(?:to|into)\s+(\w+).*translat/i) ||
                question.match(/翻[译譯](?:成|到|为|至)?\s*(\S+)/) ||
                question.match(/(\w+)(?:語|语)?(?:に翻訳|へ翻訳|に訳|訳して)/);

            if (translateMatch) {
                // This is a translation request
                const targetLanguage = translateMatch[1];
                console.log(`[KB] Translation request detected: translate to ${targetLanguage}`);

                const res = await x402Fetch(`${MCP_ENDPOINT}/tools/translate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sourceIds: selectedSources.map(s => s.id),
                        targetLanguage,
                    }),
                });
                const data = await res.json();

                if (data.success) {
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: `**Translated to ${targetLanguage}:**\n\n${data.translatedContent}`,
                    }]);
                } else {
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: `Translation failed: ${data.error || 'Unknown error'}`,
                    }]);
                }
            } else {
                // Regular query
                const res = await x402Fetch(`${MCP_ENDPOINT}/tools/query_store`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        storeName: selectedNotebook || notebooks[0]?.name,
                        question: userMsg.content,
                        sourceIds: selectedSources.map(s => s.id),
                    }),
                });

                // Update balance from header if present
                const newBalance = res.headers.get('x-new-balance');
                if (newBalance) {
                    setUsdBalance(parseFloat(newBalance));
                }

                const data = await res.json();
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: data.answer || data.error || 'No response',
                    queryId: data.queryId,
                    fromCache: data.fromCache,
                }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Error' }]);
        } finally { setIsProcessing(false); }
    };

    const submitFeedback = async (msgId: string, queryId: string, helpful: boolean) => {
        try {
            await fetch(`${MCP_ENDPOINT}/tools/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queryId, helpful }),
            });
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedbackGiven: helpful ? 'up' : 'down' } : m));
            toast.success(helpful ? 'Saved to cache!' : 'Feedback recorded');
        } catch (e) { console.error(e); }
    };

    // Update/edit an answer (for user improvements - self-learning RAG)
    const updateAnswer = async (messageId: string, queryId: string, newAnswer: string) => {
        try {
            const res = await fetch(`${MCP_ENDPOINT}/tools/update_answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queryId, newAnswer }),
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => prev.map(msg =>
                    msg.id === messageId ? { ...msg, content: newAnswer, feedbackGiven: 'edited', isEditing: false, editText: undefined } : msg
                ));
                toast.success('Answer improved & cached!');
            } else {
                toast.error(data.error || 'Failed to save improvement');
            }
        } catch (e) {
            console.error('Update error:', e);
            toast.error('Failed to save improvement');
        }
    };

    const startEditing = (msgId: string, currentContent: string) => {
        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, isEditing: true, editText: currentContent } : m
        ));
    };

    const cancelEditing = (msgId: string) => {
        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, isEditing: false, editText: undefined } : m
        ));
    };

    const updateEditText = (msgId: string, text: string) => {
        setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, editText: text } : m
        ));
    };

    const allSources = notebooks.flatMap(nb => nb.sources);
    const selectedCount = allSources.filter(s => s.selected).length;

    const getIcon = (type: string) => {
        const icons: Record<string, string> = { website: '🔗', file: '📄', text: '📝', github: '🐙', gdrive: '📁' };
        return icons[type] || '📋';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0a0a0a', color: '#fff', fontFamily: 'system-ui', fontSize: '16px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #222', backgroundColor: '#111' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>📓</span>
                    <span style={{ fontSize: '16px', fontWeight: '500' }}>{notebooks.find(n => n.name === selectedNotebook)?.displayName || knowledgeBaseText}</span>
                </div>
                {/* Balance Display - Center */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '6px' }}>
                    <span style={{ color: '#00ff88', fontSize: '14px' }}>USD: ${(usdBalance ?? 0).toFixed(2)}</span>
                    <span style={{ color: '#555' }}>|</span>
                    <span style={{ color: '#4da6ff', fontSize: '14px' }}>USDC: {usdcBalance || '0.00'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ padding: '4px 10px', backgroundColor: serverStatus === 'connected' ? '#10b981' : '#ef4444', borderRadius: '10px', fontSize: '14px' }}>
                        ● {serverStatus === 'connected' ? onlineText : offlineText}
                    </span>
                    <button onClick={() => setShowCreateModal(true)} style={{ padding: '6px 14px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' }}>
                        {createNotebookText}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left Panel - Tree */}
                <div style={{ width: '280px', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0a' }}>
                    {/* Tree Structure - No header */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
                        {isLoading ? <div style={{ textAlign: 'center', color: '#555', padding: '20px', fontSize: '15px' }}>{loadingText}</div> :
                            notebooks.length === 0 ? <div style={{ textAlign: 'center', color: '#555', padding: '30px 10px', fontSize: '15px' }}>{noNotebooksText}<br />{clickCreateText}</div> :
                                notebooks.map(nb => (
                                    <div key={nb.name} style={{ marginBottom: '4px' }}>
                                        {/* Notebook Row */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '8px 10px',
                                                borderRadius: '6px',
                                                backgroundColor: selectedNotebook === nb.name ? '#1e1b4b' : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.15s',
                                            }}
                                            onMouseEnter={(e) => { if (selectedNotebook !== nb.name) e.currentTarget.style.backgroundColor = '#1a1a1a'; }}
                                            onMouseLeave={(e) => { if (selectedNotebook !== nb.name) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            <span
                                                onClick={() => toggleNotebookExpand(nb.name)}
                                                style={{ marginRight: '8px', fontSize: '10px', color: '#666', cursor: 'pointer', userSelect: 'none' }}
                                            >
                                                {nb.expanded ? '▼' : '▶'}
                                            </span>
                                            <span
                                                onClick={() => setSelectedNotebook(nb.name)}
                                                style={{ flex: 1, fontSize: '16px', fontWeight: '500', color: selectedNotebook === nb.name ? '#c4b5fd' : '#ddd' }}
                                            >
                                                📁 {nb.displayName}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedNotebook(nb.name); setShowAddModal(true); }}
                                                title="➕ Add source to this notebook"
                                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px 8px', fontSize: '20px', fontWeight: 'bold', lineHeight: 1 }}
                                                onMouseEnter={(e) => { e.currentTarget.style.color = '#10b981'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.transform = 'scale(1)'; }}
                                            >
                                                +
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteNotebook(nb.name); }}
                                                title={nb.sources.length > 0 ? "⚠️ Delete all sources first to remove notebook" : "🗑️ Delete this notebook"}
                                                style={{
                                                    background: 'none', border: 'none',
                                                    color: nb.sources.length > 0 ? '#555' : '#888',
                                                    cursor: nb.sources.length > 0 ? 'not-allowed' : 'pointer',
                                                    padding: '4px 6px', fontSize: '16px', fontWeight: 'bold', lineHeight: 1
                                                }}
                                                onMouseEnter={(e) => { if (nb.sources.length === 0) { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.transform = 'scale(1.1)'; } }}
                                                onMouseLeave={(e) => { e.currentTarget.style.color = nb.sources.length > 0 ? '#555' : '#888'; e.currentTarget.style.transform = 'scale(1)'; }}
                                                disabled={nb.sources.length > 0}
                                            >
                                                ×
                                            </button>
                                        </div>

                                        {/* Sources */}
                                        {nb.expanded && nb.sources.length > 0 && (
                                            <div style={{ paddingLeft: '24px', paddingTop: '2px' }}>
                                                {nb.sources.map(src => (
                                                    <div
                                                        key={src.id}
                                                        title={src.name}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            padding: '6px 8px',
                                                            borderRadius: '4px',
                                                            backgroundColor: src.selected ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                                                            marginBottom: '1px',
                                                            transition: 'background-color 0.15s',
                                                        }}
                                                        onMouseEnter={(e) => { if (!src.selected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                                                        onMouseLeave={(e) => { if (!src.selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={src.selected}
                                                            onChange={() => toggleSource(src.id, nb.name)}
                                                            style={{ accentColor: '#7c3aed', marginRight: '8px', cursor: 'pointer', width: '14px', height: '14px' }}
                                                        />
                                                        <span style={{ marginRight: '6px', fontSize: '16px' }}>{getIcon(src.type)}</span>
                                                        <span
                                                            title={src.name}
                                                            style={{ flex: 1, fontSize: '16px', color: src.selected ? '#c4b5fd' : '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                        >
                                                            {src.name}
                                                        </span>
                                                        <button
                                                            onClick={() => deleteSource(src.id, nb.name)}
                                                            title="🗑️ Delete this source"
                                                            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', padding: '2px 6px' }}
                                                            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                                                            onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.transform = 'scale(1)'; }}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                    </div>
                </div>

                {/* Chat Panel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid #222', fontWeight: '500', fontSize: '16px' }}>{chatText}</div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                        {messages.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#555', marginTop: '60px', fontSize: '16px' }}>
                                <div style={{ fontSize: '32px', marginBottom: '16px' }}>🧠</div>
                                {askQuestionsText}
                                <div style={{ fontSize: '13px', marginTop: '8px', color: '#444' }}>{aiLearnsText}</div>
                            </div>
                        ) : messages.map(msg => (
                            <div key={msg.id} style={{ marginBottom: '12px', padding: '12px', backgroundColor: msg.role === 'user' ? '#1e1b4b' : '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                                {/* Header with cache and feedback info */}
                                {(msg.fromCache || msg.feedbackGiven) && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div>
                                            {msg.fromCache && <span style={{ color: '#f59e0b', fontSize: '12px' }} title="From cached answer">📚 {cachedText}</span>}
                                        </div>
                                        {msg.feedbackGiven && (
                                            <span style={{ fontSize: '11px', color: '#888' }}>
                                                {msg.feedbackGiven === 'up' ? '✅ Saved to cache' :
                                                    msg.feedbackGiven === 'edited' ? '✏️ Answer improved & cached' :
                                                        '📝 Feedback recorded'}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Message content or edit textarea */}
                                {msg.isEditing ? (
                                    <div>
                                        <textarea
                                            value={msg.editText || msg.content}
                                            onChange={(e) => updateEditText(msg.id, e.target.value)}
                                            style={{
                                                width: '100%',
                                                minHeight: '100px',
                                                padding: '10px',
                                                backgroundColor: '#0d0d0d',
                                                border: '1px solid #7c3aed',
                                                borderRadius: '6px',
                                                color: '#fff',
                                                fontSize: '13px',
                                                resize: 'vertical',
                                                lineHeight: '1.5'
                                            }}
                                        />
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <button
                                                onClick={() => updateAnswer(msg.id, msg.queryId!, msg.editText || msg.content)}
                                                style={{ padding: '6px 14px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                                            >
                                                💾 Save Improvement
                                            </button>
                                            <button
                                                onClick={() => cancelEditing(msg.id)}
                                                style={{ padding: '6px 14px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                                            ℹ️ Your improvement will be cached for future questions
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '16px', lineHeight: '1.6' }} className="markdown-content">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                )}

                                {/* Feedback buttons for assistant messages */}
                                {msg.role === 'assistant' && msg.queryId && !msg.feedbackGiven && !msg.isEditing && (
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
                                        <button
                                            onClick={() => submitFeedback(msg.id, msg.queryId!, true)}
                                            title="Good answer - save to cache"
                                            style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            👍
                                        </button>
                                        <button
                                            onClick={() => submitFeedback(msg.id, msg.queryId!, false)}
                                            title="Bad answer"
                                            style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            👎
                                        </button>
                                        <button
                                            onClick={() => startEditing(msg.id, msg.content)}
                                            title="Edit answer to improve it"
                                            style={{ background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '14px', marginLeft: 'auto' }}
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                        {isProcessing && <div style={{ color: '#888', fontSize: '15px' }}>Thinking...</div>}
                    </div>
                    <div style={{ padding: '12px', borderTop: '1px solid #222', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleQuery()} placeholder={startTypingText} disabled={selectedCount === 0} style={{ flex: 1, padding: '12px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '16px' }} />
                        <span style={{ color: '#666', fontSize: '14px' }}>{selectedCount} {sourcesText}</span>
                        <button onClick={handleQuery} disabled={selectedCount === 0 || !question.trim()} style={{ padding: '10px 14px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>→</button>
                    </div>
                </div>
            </div>

            {/* Create Notebook Modal */}
            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#1a1a1a', borderRadius: '12px', padding: '20px', width: '380px', border: '1px solid #333' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Create Notebook</h3>
                        <input type="text" value={newNotebookName} onChange={(e) => setNewNotebookName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createNotebook()} placeholder="Notebook name..." style={{ width: '100%', padding: '10px', backgroundColor: '#0a0a0a', border: '1px solid #7c3aed', borderRadius: '6px', color: '#fff', marginBottom: '16px' }} autoFocus />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={createNotebook} style={{ padding: '8px 16px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Create</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Source Modal */}
            {showAddModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: '#111', borderRadius: '12px', width: '800px', maxHeight: '85vh', overflow: 'auto', border: '1px solid #333' }}>
                        <div style={{ padding: '14px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: '600', fontSize: '24px' }}>Add Source</span>
                            <button onClick={() => { setShowAddModal(false); resetModal(); cancelAuthSession(); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '24px' }}>×</button>
                        </div>
                        <div style={{ display: 'flex', borderBottom: '1px solid #333', flexWrap: 'wrap' }}>
                            {(['web_search', 'website', 'youtube', 'text', 'file', 'github', 'gdrive'] as AddSourceTab[]).map(tab => (
                                <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'github' && isConnected('github')) fetchGithubRepos(); if (tab === 'gdrive' && isConnected('gdrive')) fetchDriveFiles('root'); }}
                                    style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #7c3aed' : '2px solid transparent', color: activeTab === tab ? '#7c3aed' : '#888', cursor: 'pointer', fontSize: '16px', minWidth: '70px', whiteSpace: 'nowrap' }}>
                                    {tab === 'web_search' && '🔍 Web Search'}
                                    {tab === 'website' && '🌐 URL'}
                                    {tab === 'youtube' && '📺 YouTube'}
                                    {tab === 'text' && '📝 Text'}
                                    {tab === 'file' && '📄 File'}
                                    {tab === 'github' && '🐙 GitHub'}
                                    {tab === 'gdrive' && '📁 Drive'}
                                </button>
                            ))}
                        </div>
                        <div style={{ padding: '16px' }}>
                            {activeTab === 'web_search' && (
                                <div>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                        <input
                                            type="text"
                                            placeholder="Search the web for sources..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
                                            style={{ flex: 1, padding: '14px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '16px' }}
                                            autoFocus
                                        />
                                        <select
                                            value={searchMode}
                                            onChange={(e) => setSearchMode(e.target.value as 'fast' | 'deep')}
                                            style={{ padding: '0 16px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', fontSize: '16px' }}
                                        >
                                            <option value="fast">⚡ Fast</option>
                                            <option value="deep">🧠 Deep</option>
                                        </select>
                                        <button
                                            onClick={handleWebSearch}
                                            disabled={isSearching || !searchQuery.trim()}
                                            style={{ padding: '0 24px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: isSearching ? 'wait' : 'pointer', fontSize: '18px' }}
                                        >
                                            {isSearching ? '...' : '→'}
                                        </button>
                                    </div>

                                    {/* Search Results */}
                                    {searchResults && (
                                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                            <div style={{ marginBottom: '16px', fontSize: '16px', lineHeight: '1.6', color: '#ddd', padding: '16px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
                                                <ReactMarkdown
                                                    components={{
                                                        strong: ({ node, ...props }) => <strong style={{ color: '#60a5fa' }} {...props} />,
                                                        a: ({ node, ...props }) => <a style={{ color: '#8b5cf6' }} target="_blank" rel="noopener noreferrer" {...props} />
                                                    }}
                                                >
                                                    {searchResults.content.replace(/\[\d+\]/g, '')}
                                                </ReactMarkdown>
                                            </div>

                                            <div style={{ marginBottom: '10px', fontWeight: '500', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Select sources to add ({selectedCitations.length}):</span>
                                                {selectedCitations.length > 0 && (
                                                    <button
                                                        onClick={handleAddCitations}
                                                        disabled={isProcessing}
                                                        style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                                                    >
                                                        {isProcessing ? 'Adding...' : `Add ${selectedCitations.length} Source(s)`}
                                                    </button>
                                                )}
                                            </div>

                                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px' }}>
                                                {searchResults.citations.length === 0 ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '13px' }}>No citations found for this search.</div>
                                                ) : (
                                                    searchResults.citations.map((url, idx) => (
                                                        <div key={idx}
                                                            onClick={() => setSelectedCitations(prev => prev.includes(url) ? prev.filter(c => c !== url) : [...prev, url])}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                padding: '10px',
                                                                borderBottom: '1px solid #222',
                                                                cursor: 'pointer',
                                                                backgroundColor: selectedCitations.includes(url) ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                                                                transition: 'background 0.2s'
                                                            }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedCitations.includes(url)}
                                                                onChange={() => { }} // Handled by div click
                                                                style={{ accentColor: '#7c3aed', marginRight: '10px', cursor: 'pointer', width: '18px', height: '18px' }}
                                                            />
                                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                                <div style={{ fontSize: '14px', color: '#fff', wordBreak: 'break-all' }}>{url}</div>
                                                            </div>
                                                            <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#888', marginLeft: '8px', fontSize: '12px' }} title="Open link">↗</a>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeTab === 'website' && (
                                <div>
                                    <input
                                        type="text"
                                        placeholder={requiresLogin ? "Enter login page URL..." : "Enter website URL..."}
                                        value={modalUrl}
                                        onChange={(e) => setModalUrl(e.target.value)}
                                        disabled={authStatus !== 'idle'}
                                        style={{ width: '100%', padding: '12px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', marginBottom: '12px', opacity: authStatus !== 'idle' ? 0.6 : 1 }}
                                    />

                                    {/* Options Row */}
                                    <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                            <input
                                                type="checkbox"
                                                checked={requiresLogin}
                                                onChange={(e) => { setRequiresLogin(e.target.checked); if (!e.target.checked) cancelAuthSession(); }}
                                                disabled={authStatus !== 'idle'}
                                                style={{ accentColor: '#7c3aed', width: '14px', height: '14px' }}
                                            />
                                            🔐 Login required
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                            <input
                                                type="checkbox"
                                                checked={enableCrawl}
                                                onChange={(e) => setEnableCrawl(e.target.checked)}
                                                disabled={authStatus !== 'idle'}
                                                style={{ accentColor: '#7c3aed', width: '14px', height: '14px' }}
                                            />
                                            🕸️ Crawl multiple pages
                                        </label>
                                    </div>

                                    {enableCrawl && (
                                        <div style={{ marginBottom: '12px' }}>
                                            <label style={{ fontSize: '11px', color: '#888' }}>Max pages: </label>
                                            <select value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} style={{ padding: '4px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', color: '#fff' }}>
                                                {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                                            </select>
                                            <span style={{ fontSize: '11px', color: '#666', marginLeft: '10px' }}>Pages combined into 1 source</span>
                                        </div>
                                    )}

                                    {/* Auth Status Messages */}
                                    {authStatus === 'waiting' && (
                                        <div style={{ padding: '10px', backgroundColor: '#2d2069', borderRadius: '6px', marginBottom: '12px', fontSize: '12px' }}>
                                            ⏳ Opening browser window for login...
                                        </div>
                                    )}
                                    {authStatus === 'ready' && (
                                        <div style={{ padding: '10px', backgroundColor: '#065f46', borderRadius: '6px', marginBottom: '12px', fontSize: '12px' }}>
                                            ✅ Browser ready! Complete login, then click the button below.
                                        </div>
                                    )}

                                    {crawlProgress && <div style={{ padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>{crawlProgress}</div>}

                                    <button
                                        onClick={handleAddWebsite}
                                        disabled={isProcessing || !modalUrl.trim()}
                                        style={{ width: '100%', padding: '12px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: isProcessing ? 'wait' : 'pointer', fontSize: '14px' }}
                                    >
                                        {isProcessing ? '⏳ Processing...' :
                                            requiresLogin && authStatus === 'idle' ? '🔐 Open Login Page' :
                                                requiresLogin && authStatus === 'ready' ? (enableCrawl ? '🕸️ Crawl After Login' : '📥 Scrape After Login') :
                                                    enableCrawl ? '🕸️ Crawl Website' : '📥 Add Website'}
                                    </button>
                                </div>
                            )}

                            {activeTab === 'youtube' && (
                                <div>
                                    <input
                                        type="text"
                                        placeholder="https://youtube.com/watch?v=..."
                                        value={modalUrl}
                                        onChange={(e) => setModalUrl(e.target.value)}
                                        style={{ width: '100%', padding: '12px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', marginBottom: '12px' }}
                                    />
                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
                                        📺 Extracts video transcript and metadata
                                    </div>
                                    <button
                                        onClick={handleAddYouTube}
                                        disabled={isProcessing || !modalUrl.trim()}
                                        style={{ width: '100%', padding: '12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: isProcessing ? 'wait' : 'pointer', fontSize: '14px' }}
                                    >
                                        {isProcessing ? '⏳ Processing...' : '📺 Add YouTube Video'}
                                    </button>
                                </div>
                            )}
                            {activeTab === 'text' && (
                                <div>
                                    <input type="text" placeholder="Source name" value={modalTextName} onChange={(e) => setModalTextName(e.target.value)} style={{ width: '100%', padding: '10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', marginBottom: '12px' }} />
                                    <textarea placeholder="Paste text here..." value={modalText} onChange={(e) => setModalText(e.target.value)} style={{ width: '100%', minHeight: '120px', padding: '10px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', resize: 'vertical', marginBottom: '12px' }} />
                                    <button onClick={handleAddText} disabled={isProcessing} style={{ width: '100%', padding: '10px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                                        {isProcessing ? 'Adding...' : 'Add Text'}
                                    </button>
                                </div>
                            )}
                            {activeTab === 'file' && (
                                <div>
                                    <input ref={fileInputRef} type="file" accept=".txt,.md,.json,.csv,.xml,.html,.css,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.yml,.yaml,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp" onChange={handleFileUpload} style={{ display: 'none' }} />
                                    <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} style={{ padding: '10px 20px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '12px', fontSize: '14px' }}>
                                        {isProcessing ? '⏳ Uploading...' : '📄 Choose File'}
                                    </button>
                                    <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>Supported: PDF, DOCX, PPTX, TXT, MD, JSON, CSV, Images (PNG, JPG), HTML, JS, TS, PY</div>
                                    <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>✅ Full text extraction for all file types including PDFs and images</div>
                                </div>
                            )}
                            {activeTab === 'github' && (
                                <div>
                                    {!isConnected('github') ? (
                                        <button onClick={() => startOAuth('github')} style={{ width: '100%', padding: '10px', backgroundColor: '#333', color: '#fff', border: '1px solid #444', borderRadius: '6px', cursor: 'pointer' }}>
                                            🐙 Connect GitHub
                                        </button>
                                    ) : (
                                        <div>
                                            <select value={selectedRepo} onChange={(e) => { setSelectedRepo(e.target.value); fetchRepoFiles(e.target.value); }} style={{ width: '100%', padding: '8px', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '6px', color: '#fff', marginBottom: '12px' }}>
                                                <option value="">Select repository...</option>
                                                {githubRepos.map(r => <option key={r.full_name} value={r.full_name}>{r.full_name}</option>)}
                                            </select>
                                            {repoFiles.length > 0 && (
                                                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px' }}>
                                                    {repoFiles.map(f => (
                                                        <div key={f.path} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #222' }}>
                                                            <span style={{ fontSize: '12px' }}>{f.path}</span>
                                                            <button onClick={() => addGithubFile(selectedRepo, f.path)} disabled={isProcessing} style={{ padding: '4px 8px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>Add</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeTab === 'gdrive' && (
                                <div>
                                    {!isConnected('gdrive') ? (
                                        <button onClick={() => startOAuth('gdrive')} style={{ width: '100%', padding: '12px', backgroundColor: '#4285f4', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                                            📁 Connect Google Drive
                                        </button>
                                    ) : (
                                        <div>
                                            {/* Navigation header */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                                {(driveFolderId !== 'root' || driveFolderStack.length > 0) && (
                                                    <button
                                                        onClick={navigateBackFolder}
                                                        style={{ padding: '6px 12px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                                                    >
                                                        ← Back
                                                    </button>
                                                )}
                                                <span style={{ fontSize: '11px', color: '#888' }}>
                                                    {driveFolderStack.length === 0 ? '📁 My Drive' : `📁 ${driveFolderStack[driveFolderStack.length - 1]?.name || 'Folder'}`}
                                                </span>
                                            </div>

                                            {/* Files list */}
                                            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #333', borderRadius: '6px' }}>
                                                {isLoadingFiles ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>⏳ Loading files...</div>
                                                ) : driveFiles.length === 0 ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No files in this folder</div>
                                                ) : driveFiles.map(f => (
                                                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #222' }}>
                                                        <span style={{ fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {f.mimeType?.includes('folder') ? '📁' : '📄'} {f.name}
                                                        </span>
                                                        {f.mimeType?.includes('folder') ? (
                                                            <button
                                                                onClick={() => navigateToFolder(f.id, f.name)}
                                                                style={{ padding: '4px 10px', backgroundColor: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', marginLeft: '8px' }}
                                                            >
                                                                Open
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => addDriveFile(f.id, f.name)}
                                                                disabled={isProcessing}
                                                                style={{ padding: '4px 10px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', marginLeft: '8px' }}
                                                            >
                                                                {isProcessing ? '...' : 'Add'}
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileSearchKnowledgeBase;
