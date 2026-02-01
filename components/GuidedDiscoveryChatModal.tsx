import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import styles from './GuidedDiscoveryChatModal.module.css';
import { toast } from 'react-toastify';
import { LocalizationContext } from '../util/LocalizationContext';
import { LocalizedText, useLocalizedString } from '../util/LocalizedText';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- NEW COMPONENT: Ideas With Tabs ---
const IdeasWithTabs: React.FC<{
    categories: string[],
    initialCategory: string,
    initialIdeasMap?: Record<string, string[]>,
    onIdeaClick: (idea: string) => void,
    onCategoryChange: (category: string) => void,
    language: string
}> = ({ categories, initialCategory, initialIdeasMap, onIdeaClick, onCategoryChange, language }) => {
    const [activeTab, setActiveTab] = useState(initialCategory);
    const [ideasMap, setIdeasMap] = useState<Record<string, string[]>>(initialIdeasMap || {});
    const [loading, setLoading] = useState(false);
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);

    const fetchIdeas = async (category: string, loadMore = false) => {
        setLoading(true);
        try {
            // If loadMore, we exclude current visible ones to get fresh ones
            const currentIdeas = ideasMap[category] || [];
            const resp = await fetch('/api/perplexity_use_cases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get_ideas',
                    category,
                    language,
                    excludeIdeas: currentIdeas,
                    loadMore
                }),
            });
            const data = await resp.json();
            const newIdeas = data.ideas || [];

            setIdeasMap(prev => ({
                ...prev,
                // Overwrite previous ideas with new ones if loadMore is true (or just set for initial)
                [category]: newIdeas
            }));
        } catch (e) {
            console.error(e);
            toast.error('Failed to load ideas');
        } finally {
            setLoading(false);
        }
    };

    // Fetch when tab changes if empty
    useEffect(() => {
        // If the parent changed the initialCategory (via remount), update internal activeTab
        setActiveTab(initialCategory);

        // Also ensure ideasMap has what we passed
        if (initialIdeasMap) {
            setIdeasMap(prev => ({ ...prev, ...initialIdeasMap }));
        }
    }, [initialCategory, initialIdeasMap]);

    // Fetch if current active tab has no ideas
    useEffect(() => {
        if (!ideasMap[activeTab] || ideasMap[activeTab].length === 0) {
            fetchIdeas(activeTab);
        }
    }, [activeTab]);

    const handleLoadMore = () => {
        fetchIdeas(activeTab, true);
    };

    // Simple markdown renderer for **bold**
    const renderContent = (text: string) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} style={{ fontWeight: '700', color: '#1e40af' }}>{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    return (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingBottom: '0.5rem' }}>
                {categories.map(cat => {
                    const isActive = activeTab === cat;
                    const isHovered = hoveredTab === cat;
                    return (
                        <button
                            key={cat}
                            // Trigger parent change handler to refresh session
                            onClick={() => onCategoryChange(cat)}
                            onMouseEnter={() => setHoveredTab(cat)}
                            onMouseLeave={() => setHoveredTab(null)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: isActive ? '#2563eb' : '#e5e7eb', // Blue active, gray inactive
                                backgroundColor: isHovered ? '#fce7f3' : (isActive ? '#2563eb' : '#ffffff'), // Pink hover, Blue active, White inactive
                                color: isActive ? '#ffffff' : '#1f2937', // White text active, Dark gray inactive
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: isActive ? 600 : 500,
                                transition: 'all 0.2s ease',
                                boxShadow: isActive ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
                            }}
                        >
                            <LocalizedText name={cat} />
                        </button>
                    );
                })}
            </div>

            {/* Ideas Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '200px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px', color: '#2563eb' }}>
                        <div style={{ width: '24px', height: '24px', border: '3px solid #bfdbfe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                ) : (
                    (ideasMap[activeTab] || []).map((idea, i) => (
                        <button
                            key={i}
                            onClick={() => onIdeaClick(idea)}
                            style={{
                                textAlign: 'left',
                                padding: '0.8rem 1rem',
                                backgroundColor: '#f8fafc', // Slate 50
                                border: '1px solid #e2e8f0', // Slate 200
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                color: '#334155', // Slate 700
                                lineHeight: '1.5',
                                transition: 'all 0.2s',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.75rem'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = '#eff6ff'; // Blue 50
                                e.currentTarget.style.borderColor = '#60a5fa'; // Blue 400
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                        >
                            <span style={{ fontSize: '1.1rem' }}>🔍</span>
                            <span>{renderContent(idea)}</span>
                        </button>
                    ))
                )}

                {/* Load More Button - "Overwrite" */}
                {!loading && (ideasMap[activeTab] || []).length > 0 && (
                    <button
                        onClick={handleLoadMore}
                        style={{
                            marginTop: '0.5rem',
                            alignSelf: 'center',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '0.5rem 1.5rem',
                            borderRadius: '20px',
                            color: '#2563eb',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                    >
                        ⚡ <LocalizedText name="More ideas" />
                    </button>
                )}
            </div>
        </div>
    );
};

/**
 * A modern chat UI that drives a multi‑turn discovery flow.
 * It talks to /api/guided_discovery and stores the conversation locally.
 * Now includes Self-Learning feedback loops.
 */
const GuidedDiscoveryChatModal: React.FC<{ isOpen: boolean; onClose: () => void; externalVisibility?: boolean }> = ({ isOpen, onClose, externalVisibility }) => {
    const { language } = React.useContext(LocalizationContext);
    // Track conversationId and feedback status for each message
    const [messages, setMessages] = useState<Array<{
        role: 'user' | 'assistant';
        content: string;
        results?: any[]; // Search results for JSX rendering
        ideas?: string[]; // Legacy ideas (single list)
        ideasCategories?: string[]; // NEW: Categories for tabs
        initialCategory?: string;
        initialIdeasMap?: Record<string, string[]>;
        conversationId?: string; // ID for feedback tracking
        feedbackGiven?: boolean;
    }>>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [lastResults, setLastResults] = useState<any[]>([]); // Track results for follow-ups
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Constant Categories
    const CATEGORIES = ["Business", "Technology", "Finance", "Marketing", "Education", "Productivity"];

    // Localized UI strings
    const restartText = useLocalizedString('Restart');
    const showIdeasText = useLocalizedString('Show me ideas');
    const showMoreIdeasText = useLocalizedString('Show me more ideas');
    const placeholderText = useLocalizedString('Type your goal here...');
    const welcomeMessage = useLocalizedString('Hi there! I can help you find the perfect AI tool from our collection of over 5,500 tasks.');
    const welcomeHint = useLocalizedString('Tell me what you want to achieve, or click "Show me ideas" below!');
    const ideasIntroText = useLocalizedString('Here are some ideas based on real tools (click any to search):');
    // Result labels
    const categoryLabel = useLocalizedString('Category');
    const personaLabel = useLocalizedString('Persona');
    const taskLabel = useLocalizedString('Task');
    const scoreLabel = useLocalizedString('Score');
    const descriptionLabel = useLocalizedString('Description');

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        const userMessage = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setLoading(true);
        try {
            const response = await fetch('/api/guided_discovery', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    chatHistory: messages,
                    previousResults: lastResults,
                    language: language // Pass language for response translation
                }),
            });

            console.log('API Response Status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', errorText);
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `API Error (${response.status}): ${errorText}`
                }]);
                return;
            }

            const data = await response.json();
            console.log('API Response Data:', data);

            // Update lastResults only on new search
            if (data.isNewSearch && data.results?.length > 0) {
                setLastResults(data.results);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.analysis || '',
                results: data.isNewSearch ? data.results : [], // Only show results table for new searches
                conversationId: `conv_${Date.now()}`
            }]);
            if (data.done) {
                toast.success('Discovery completed!');
            }
        } catch (err: any) {
            console.error('Fetch error:', err);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Network Error: ${err.message}`
            }]);
            toast.error('Error communicating with the discovery service');
        } finally {
            setLoading(false);
        }
    };

    const handleFeedback = async (index: number, rating: 'excellent' | 'helpful' | 'not-helpful', conversationId?: string) => {
        // Find the message to get context (query/response)
        const msg = messages[index];
        const prevMsg = messages[index - 1]; // User query usually precedes assistant response

        if (!conversationId || !prevMsg) return;

        try {
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId,
                    query: prevMsg.content,
                    response: msg.content,
                    rating
                })
            });

            // Update UI to show feedback given
            setMessages(prev => prev.map((m, i) => i === index ? { ...m, feedbackGiven: true } : m));
            if (rating === 'excellent') toast.success('Thanks! I\'ve learned from this interaction.');
            else toast.info('Thanks for your feedback.');
        } catch (e) {
            console.error(e);
        }
    };

    const handleIdeaSearch = async () => {
        setLoading(true);
        try {
            // Fetch Initial Ideas for First Category (Business)
            const firstCat = CATEGORIES[0];
            const ideasResp = await fetch('/api/perplexity_use_cases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get_ideas', category: firstCat, language }),
            });
            const ideasData = await ideasResp.json();

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `💡 **${ideasIntroText}**`,
                ideasCategories: CATEGORIES,
                initialCategory: firstCat,
                initialIdeasMap: { [firstCat]: ideasData.ideas || [] }
            }]);
        } catch (e) {
            console.error(e);
            toast.error('Failed to fetch ideas');
        } finally {
            setLoading(false);
        }
    };

    // NEW: Handle tab switching by refreshing the session (clearing messages)
    const handleTabChange = (newCategory: string) => {
        // Don't just clear, set the state to a fresh customized start
        setLoading(true); // briefly show loading state logic if needed, but we just reset messages

        // We reset messages directly to contain ONLY the new ideas panel
        setMessages([{
            role: 'assistant',
            content: `💡 **${ideasIntroText}**`,
            ideasCategories: CATEGORIES,
            initialCategory: newCategory,
            initialIdeasMap: {}, // Empty to trigger fetch in component
            conversationId: `conv_${Date.now()}`
        }]);
        setLastResults([]);
        setActiveDescription(null);
        setLoading(false);
    };

    // Function to handle clicking an idea (triggers search)
    const handleIdeaClick = (idea: string) => {
        const cleanIdea = idea.replace(/\*\*/g, '');
        setInput(cleanIdea);
        // Trigger the form submit programmatically
        const form = document.querySelector('form');
        if (form) {
            const event = new Event('submit', { bubbles: true, cancelable: true });
            form.dispatchEvent(event);
        }
    };

    // Render markdown: **bold** and [text](url) as proper JSX


    // State for showing task description
    const [activeDescription, setActiveDescription] = useState<string | null>(null);

    // Format results as styled JSX (like production BusinessChatModal)
    const formatResults = (results: any[]) => {
        if (!results || results.length === 0) return null;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

        return (
            <div style={{ marginBottom: '1rem' }}>
                {results.map((result, index) => {
                    const url = `${baseUrl}/ChatHome_bus?selectedRole=${encodeURIComponent(result.role)}&selectedCategory=${encodeURIComponent(result.department)}&selectedTask=${encodeURIComponent(result.task)}`;

                    return (
                        <div key={index} style={{
                            marginBottom: '1rem',
                            paddingBottom: '1rem',
                            borderBottom: '2px solid #ddd',
                            backgroundColor: '#fafafa',
                            padding: '0.75rem',
                            borderRadius: '8px'
                        }}>
                            <div><strong style={{ color: '#6366f1' }}>{categoryLabel}:</strong> <LocalizedText name={result.department} /></div>
                            <div><strong style={{ color: '#6366f1' }}>{personaLabel}:</strong> <LocalizedText name={result.role} /></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <strong style={{ color: '#6366f1' }}>{taskLabel}:</strong>{' '}
                                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                                    <LocalizedText name={result.task} />
                                </a>
                                {/* D button for description */}
                                <button
                                    onClick={() => setActiveDescription(activeDescription === result.task ? null : result.task)}
                                    style={{
                                        padding: '0.2rem 0.5rem',
                                        backgroundColor: activeDescription === result.task ? '#ffd700' : '#007bff',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        marginLeft: '0.25rem'
                                    }}
                                    title="View task description"
                                >
                                    D
                                </button>
                            </div>
                            <div><strong style={{ color: '#6366f1' }}>{scoreLabel}:</strong> {result.score?.toFixed(2) || 'N/A'}</div>
                            {/* Show description if D button clicked */}
                            {activeDescription === result.task && result.description && (
                                <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.9rem' }}>
                                    <strong>{descriptionLabel}:</strong> <LocalizedText name={result.description} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Visibility logic: handled either by isOpen logic or externalVisibility prop from context
    const shouldShow = isOpen || externalVisibility;

    if (!shouldShow) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>

                <header className={styles.header}>
                    <div className={styles.title}>
                        🤖 <LocalizedText name="AI Tool Discovery" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            className={styles.restartButton}
                            onClick={() => { setMessages([]); setLastResults([]); setActiveDescription(null); }}
                            title={restartText}
                        >
                            🔄 {restartText}
                        </button>
                        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
                            &times;
                        </button>
                    </div>
                </header>

                <div className={styles.chatContainer}>
                    {messages.length === 0 && (
                        <div className={styles.assistantRow}>
                            <div className={`${styles.messageBubble} ${styles.assistantBubble}`}>
                                👋 {welcomeMessage}
                                <br /><br />
                                {welcomeHint}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={msg.role === 'user' ? styles.userRow : styles.assistantRow}>
                            <div className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                                {/* Render structured results as JSX */}
                                {msg.results && msg.results.length > 0 && formatResults(msg.results)}

                                {/* Render analysis text with markdown links */}
                                {msg.content && (
                                    <div style={{ marginTop: msg.results?.length ? '0.5rem' : 0, borderTop: msg.results?.length ? '1px solid #ddd' : 'none', paddingTop: msg.results?.length ? '0.5rem' : 0 }}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                a: ({ node, ...props }) => <a style={{ color: '#2563eb', fontWeight: 500 }} target="_blank" rel="noopener noreferrer" {...props} />
                                            }}
                                        >
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}

                                {/* Render ideas as clickable buttons (Legacy) */}
                                {msg.ideas && msg.ideas.length > 0 && !msg.ideasCategories && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {msg.ideas.map((idea, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleIdeaClick(idea)}
                                                style={{
                                                    textAlign: 'left',
                                                    padding: '0.5rem 0.75rem',
                                                    backgroundColor: '#f0fdf4',
                                                    border: '1px solid #86efac',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.9rem',
                                                    color: '#166534',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                            >
                                                🔍 {idea}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Render New Tabbed Ideas */}
                                {msg.ideasCategories && msg.initialCategory && (
                                    <IdeasWithTabs
                                        categories={msg.ideasCategories}
                                        initialCategory={msg.initialCategory}
                                        initialIdeasMap={msg.initialIdeasMap}
                                        onIdeaClick={handleIdeaClick}
                                        onCategoryChange={handleTabChange}
                                        language={language}
                                    />
                                )}


                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className={styles.inputArea}>
                    <button
                        type="button"
                        className={styles.ideaButton}
                        onClick={handleIdeaSearch}
                        disabled={loading}
                    >
                        💡 {messages.some(m => m.ideas && m.ideas.length > 0) ? showMoreIdeasText : showIdeasText}
                    </button>

                    <form onSubmit={handleSubmit} className={styles.inputForm}>
                        <input
                            value={input}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                            placeholder={placeholderText}
                            className={styles.inputField}
                            disabled={loading}
                            autoFocus
                        />
                        <button type="submit" className={styles.sendButton} disabled={loading || !input.trim()}>
                            {loading ? '...' : <LocalizedText name="Send" />} ➢
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default GuidedDiscoveryChatModal;
