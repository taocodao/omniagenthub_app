// pages/auth/linkedin-success.tsx
// Success page after LinkedIn OAuth completion

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function LinkedInSuccess() {
    const router = useRouter();
    const { status } = router.query;
    const [countdown, setCountdown] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Redirect back to home or previous page
                    window.close();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const isPending = status === 'pending';

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

                {/* Success Icon */}
                <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: isPending ? '#FFA500' : '#22C55E',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                }}>
                    {isPending ? (
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" width="32" height="32" fill="white">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                    )}
                </div>

                <h1 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#333',
                    marginBottom: '12px',
                }}>
                    {isPending ? 'Almost there!' : 'LinkedIn Connected!'}
                </h1>

                <p style={{
                    fontSize: '16px',
                    color: '#666',
                    marginBottom: '24px',
                    lineHeight: '1.5',
                }}>
                    {isPending
                        ? 'Your LinkedIn connection is being processed. This may take a few moments.'
                        : 'Your LinkedIn account has been successfully connected. You can now post AI-generated content directly to your profile.'
                    }
                </p>

                <p style={{
                    fontSize: '14px',
                    color: '#999',
                    marginBottom: '16px',
                }}>
                    This window will close in {countdown} seconds...
                </p>

                <Link href="/" style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    backgroundColor: '#0077B5',
                    color: 'white',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '500',
                }}>
                    Return to App
                </Link>
            </div>
        </div>
    );
}
