// components/integrations/LinkedInPostButton.tsx
// Button component to post AI-generated content to LinkedIn

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { LocalizedText, getLocalizedString } from '../../util/LocalizedText';
import styles from '../../styles/Home5.module.css';

interface LinkedInPostButtonProps {
    content: string;
    disabled?: boolean;
    language?: string;
}

interface ConnectionStatus {
    connected: boolean;
    status: string | null;
}

export function LinkedInPostButton({ content, disabled = false, language = 'en' }: LinkedInPostButtonProps) {
    const [isPosting, setIsPosting] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ connected: false, status: null });
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Check connection status on mount
    useEffect(() => {
        checkConnectionStatus();
    }, []);

    const checkConnectionStatus = async () => {
        try {
            const response = await fetch('/api/integrations/linkedin/status');
            if (response.ok) {
                const data = await response.json();
                setConnectionStatus({
                    connected: data.connected,
                    status: data.status,
                });
            }
        } catch (error) {
            console.error('Error checking LinkedIn status:', error);
        }
    };

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const response = await fetch('/api/integrations/linkedin/connect', {
                method: 'POST',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to initiate connection');
            }

            const { redirectUrl } = await response.json();

            // Redirect to Composio OAuth flow
            window.location.href = redirectUrl;
        } catch (error: any) {
            console.error('Error connecting to LinkedIn:', error);
            toast.error(error.message || 'Failed to connect to LinkedIn');
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            const response = await fetch('/api/integrations/linkedin/disconnect', {
                method: 'DELETE',
            });

            if (response.ok) {
                setConnectionStatus({ connected: false, status: null });
                toast.success(await getLocalizedString('LinkedIn disconnected', language));
            }
        } catch (error) {
            console.error('Error disconnecting LinkedIn:', error);
        }
    };

    const handlePost = async () => {
        if (!content || content.trim().length === 0) {
            toast.warning(await getLocalizedString('No content to post', language));
            return;
        }

        setShowConfirmModal(false);
        setIsPosting(true);

        try {
            const response = await fetch('/api/linkedin/post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content }),
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.needsConnection || data.needsReconnection) {
                    setConnectionStatus({ connected: false, status: 'EXPIRED' });
                    toast.error(await getLocalizedString('Please reconnect your LinkedIn account', language));
                    return;
                }
                throw new Error(data.error || 'Failed to post');
            }

            toast.success(await getLocalizedString('Posted to LinkedIn successfully!', language));
        } catch (error: any) {
            console.error('Error posting to LinkedIn:', error);
            toast.error(error.message || 'Failed to post to LinkedIn');
        } finally {
            setIsPosting(false);
        }
    };

    // Render connect button if not connected
    if (!connectionStatus.connected) {
        return (
            <div className={styles.buttonWrapper}>
                <button
                    onClick={handleConnect}
                    className={styles.cardButton}
                    disabled={disabled || isConnecting}
                    style={{
                        backgroundColor: '#0077B5',
                        color: 'white',
                    }}
                >
                    {isConnecting ? (
                        <LocalizedText name="Connecting..." />
                    ) : (
                        <>
                            <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                style={{ marginRight: '6px', fill: 'currentColor', display: 'inline-block', verticalAlign: 'middle' }}
                            >
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                            </svg>
                            <LocalizedText name="Connect LinkedIn" />
                        </>
                    )}
                </button>
                <div className={styles.buttonTooltip}>
                    <LocalizedText name="Connect your LinkedIn account to share content" />
                </div>
            </div>
        );
    }

    // Render post button when connected
    return (
        <>
            <div className={styles.buttonWrapper}>
                <button
                    onClick={() => setShowConfirmModal(true)}
                    className={styles.cardButton}
                    disabled={disabled || isPosting || !content}
                    style={{
                        backgroundColor: '#0077B5',
                        color: 'white',
                    }}
                >
                    {isPosting ? (
                        <LocalizedText name="Posting..." />
                    ) : (
                        <>
                            <svg
                                viewBox="0 0 24 24"
                                width="16"
                                height="16"
                                style={{ marginRight: '6px', fill: 'currentColor', display: 'inline-block', verticalAlign: 'middle' }}
                            >
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                            </svg>
                            <LocalizedText name="Post to LinkedIn" />
                        </>
                    )}
                </button>
                <div className={styles.buttonTooltip}>
                    <LocalizedText name="Share this content on your LinkedIn profile" />
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowConfirmModal(false)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            padding: '24px',
                            maxWidth: '500px',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            margin: '20px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#0077B5' }}>
                            <LocalizedText name="Post to LinkedIn" />
                        </h3>

                        <p style={{ marginBottom: '12px', color: '#666' }}>
                            <LocalizedText name="Preview of your post:" />
                        </p>

                        <div
                            style={{
                                backgroundColor: '#f5f5f5',
                                borderRadius: '4px',
                                padding: '12px',
                                marginBottom: '20px',
                                maxHeight: '200px',
                                overflow: 'auto',
                                fontSize: '14px',
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {content.length > 500 ? content.substring(0, 500) + '...' : content}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                style={{
                                    padding: '8px 16px',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    backgroundColor: 'white',
                                    cursor: 'pointer',
                                }}
                            >
                                <LocalizedText name="Cancel" />
                            </button>
                            <button
                                onClick={handlePost}
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '4px',
                                    backgroundColor: '#0077B5',
                                    color: 'white',
                                    cursor: 'pointer',
                                }}
                            >
                                <LocalizedText name="Confirm & Post" />
                            </button>
                        </div>

                        {/* Disconnect option */}
                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                            <button
                                onClick={handleDisconnect}
                                style={{
                                    fontSize: '12px',
                                    color: '#999',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                }}
                            >
                                <LocalizedText name="Disconnect LinkedIn account" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default LinkedInPostButton;
