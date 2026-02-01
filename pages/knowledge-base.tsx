'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import FileSearchKnowledgeBase from '../components/FileSearchKnowledgeBase';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const KnowledgeBasePage: React.FC = () => {
    const router = useRouter();
    const [userKey, setUserKey] = useState<string>('');
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize userKey from URL or localStorage
    useEffect(() => {
        if (!router.isReady) return;

        // Get userKey from URL query params
        const urlUserKey = router.query.userKey as string;

        if (urlUserKey) {
            // If userKey is in URL, save it to localStorage for OAuth redirect fallback
            setUserKey(urlUserKey);
            localStorage.setItem('kb_userKey', urlUserKey);
        } else {
            // Try to get userKey from localStorage (fallback after OAuth redirect)
            const storedUserKey = localStorage.getItem('kb_userKey');
            if (storedUserKey) {
                setUserKey(storedUserKey);
            }
        }
        setIsInitialized(true);
    }, [router.isReady, router.query.userKey]);

    const handleClose = () => {
        // Close the tab or go back
        window.close();
        // If window.close() doesn't work (not opened by script), go back
        setTimeout(() => {
            router.back();
        }, 100);
    };

    // Wait for initialization before checking userKey
    if (!isInitialized) {
        return (
            <div style={{
                minHeight: '100vh',
                backgroundColor: '#0a0a0a',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui'
            }}>
                <div style={{ fontSize: '24px' }}>⏳ Loading...</div>
            </div>
        );
    }

    if (!userKey) {
        return (
            <div style={{
                minHeight: '100vh',
                backgroundColor: '#0a0a0a',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'system-ui'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
                    <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Authentication Required</h1>
                    <p style={{ color: '#888' }}>Please connect your wallet to access the Knowledge Base</p>
                    <button
                        onClick={() => router.push('/')}
                        style={{
                            marginTop: '24px',
                            padding: '12px 24px',
                            backgroundColor: '#7c3aed',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        Go to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
            <ToastContainer position="top-right" theme="dark" />
            <FileSearchKnowledgeBase
                userKey={userKey}
                onClose={handleClose}
            />
        </div>
    );
};

export default KnowledgeBasePage;
