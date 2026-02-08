// pages/auth/linkedin-error.tsx
// Error page for LinkedIn OAuth failures

import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function LinkedInError() {
    const router = useRouter();
    const { error } = router.query;

    const getErrorMessage = (errorCode: string | string[] | undefined) => {
        if (!errorCode) return 'An unknown error occurred';

        const code = Array.isArray(errorCode) ? errorCode[0] : errorCode;

        switch (code) {
            case 'no_pending_connection':
                return 'No pending LinkedIn connection was found. Please try connecting again.';
            case 'callback_failed':
                return 'The OAuth callback failed. Please try connecting again.';
            case 'not_authenticated':
                return 'You must be signed in to connect your LinkedIn account.';
            case 'access_denied':
                return 'LinkedIn access was denied. Please authorize the app to continue.';
            default:
                return decodeURIComponent(code);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
            padding: '20px',
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '40px',
                textAlign: 'center',
                maxWidth: '400px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}>
                {/* LinkedIn Logo */}
                <div style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#0077B5',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                }}>
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="white">
                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                    </svg>
                </div>

                {/* Error Icon */}
                <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: '#EF4444',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                }}>
                    <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                </div>

                <h1 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#333',
                    marginBottom: '12px',
                }}>
                    Connection Failed
                </h1>

                <p style={{
                    fontSize: '16px',
                    color: '#666',
                    marginBottom: '24px',
                    lineHeight: '1.5',
                }}>
                    {getErrorMessage(error)}
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <Link href="/" style={{
                        display: 'inline-block',
                        padding: '12px 24px',
                        backgroundColor: '#f5f5f5',
                        color: '#333',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        fontWeight: '500',
                    }}>
                        Go Back
                    </Link>

                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            display: 'inline-block',
                            padding: '12px 24px',
                            backgroundColor: '#0077B5',
                            color: 'white',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: '500',
                            cursor: 'pointer',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
