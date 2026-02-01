// components/ChatInterface.tsx - CLEANED UP UI

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import remarkGfm from 'remark-gfm';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sourcesUsed?: string[];
}

interface ChatInterfaceProps {
  notebookId: string;
  userKey: string;
  sources: Array<{ id: string; title: string; selected: boolean; status: string; quivrDocId?: string }>;
  selectedSources: string[];
  userAddress: string;
  isReady: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  notebookId,
  userKey,
  sources,
  selectedSources,
  userAddress,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/notebooks/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userKey,
          notebookId,
          query: input,
          selectedSources,
          sources: sources.filter((s) => selectedSources.includes(s.id)),
          conversationHistory: messages,
          userAddress,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: Message = {
          id: `msg${Date.now()}assistant`,
          role: 'assistant',
          content: data.response,
          timestamp: data.timestamp,
          sourcesUsed: data.sourcesUsed,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(data.message || 'Chat failed');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `msg${Date.now()}error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages Area - EXPANDED */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#ffffff' }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
            {sources.length === 0 ? (
              <>
                <span style={{ fontSize: '48px', marginBottom: '16px' }}>📚</span>
                <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Upload sources to start chatting</h4>
                <p style={{ margin: 0, fontSize: '14px' }}>Click &quot;Add&quot; to upload files</p>
              </>
            ) : selectedSources.length === 0 ? (
              <>
                <span style={{ fontSize: '48px', marginBottom: '16px' }}>✅</span>
                <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Select at least one source</h4>
                <p style={{ margin: 0, fontSize: '14px' }}>Check the box next to your uploaded files</p>
              </>
            ) : (
              <>
                <span style={{ fontSize: '48px', marginBottom: '16px' }}>💬</span>
                <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>Ready to chat!</h4>
                <p style={{ margin: 0, fontSize: '14px' }}>Ask me anything about your selected sources</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ marginBottom: '24px', display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '75%', padding: '12px 16px', borderRadius: '12px', background: msg.role === 'user' ? '#1976d2' : '#f5f5f5', color: msg.role === 'user' ? '#fff' : '#333', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                  {msg.role === 'user' ? (
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
                  ) : (
                    <div className="markdown-content" style={{ fontSize: '14px', lineHeight: '1.6' }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" {...props}>
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: '3px', fontSize: '13px', fontFamily: 'monospace' }} {...props}>
                                {children}
                              </code>
                            );
                          },
                          h1: ({ children }) => <h1 style={{ fontSize: '24px', marginTop: '16px', marginBottom: '8px' }}>{children}</h1>,
                          h2: ({ children }) => <h2 style={{ fontSize: '20px', marginTop: '14px', marginBottom: '6px' }}>{children}</h2>,
                          h3: ({ children }) => <h3 style={{ fontSize: '18px', marginTop: '12px', marginBottom: '6px' }}>{children}</h3>,
                          ul: ({ children }) => <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px' }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px' }}>{children}</ol>,
                          li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                          p: ({ children }) => <p style={{ marginTop: '8px', marginBottom: '8px' }}>{children}</p>,
                          blockquote: ({ children }) => <blockquote style={{ borderLeft: '4px solid #ddd', paddingLeft: '12px', marginLeft: 0, color: '#666', fontStyle: 'italic' }}>{children}</blockquote>,
                          a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>{children}</a>,
                          table: ({ children }) => <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', marginBottom: '12px' }}>{children}</table>,
                          th: ({ children }) => <th style={{ border: '1px solid #ddd', padding: '8px', background: '#f0f0f0', fontWeight: 'bold', textAlign: 'left' }}>{children}</th>,
                          td: ({ children }) => <td style={{ border: '1px solid #ddd', padding: '8px' }}>{children}</td>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* Sources Used */}
                  {msg.sourcesUsed && msg.sourcesUsed.length > 0 && (
                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e0e0e0', fontSize: '12px', color: '#666' }}>
                      <strong>Sources:</strong> {msg.sourcesUsed.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #e0e0e0', background: '#f8f9fa' }}>
        <div style={{ display: 'flex', gap: '12px', maxWidth: '900px', margin: '0 auto' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={selectedSources.length === 0 ? 'Select sources to start chatting...' : 'Ask a question about your sources...'}
            disabled={isLoading || selectedSources.length === 0}
            style={{ flex: 1, padding: '12px 16px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
            onFocus={(e) => (e.target.style.borderColor = '#1976d2')}
            onBlur={(e) => (e.target.style.borderColor = '#ddd')}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || selectedSources.length === 0}
            style={{ padding: '12px 24px', background: isLoading || !input.trim() || selectedSources.length === 0 ? '#ccc' : '#1976d2', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: isLoading || !input.trim() || selectedSources.length === 0 ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => {
              if (!isLoading && input.trim() && selectedSources.length > 0) e.currentTarget.style.background = '#1565c0';
            }}
            onMouseLeave={(e) => {
              if (!isLoading && input.trim() && selectedSources.length > 0) e.currentTarget.style.background = '#1976d2';
            }}
          >
            {isLoading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
