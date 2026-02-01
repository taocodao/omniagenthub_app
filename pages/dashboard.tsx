// pages/dashboard.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useActiveWallet } from 'thirdweb/react';

const Dashboard: React.FC = () => {
    const router = useRouter();
    const wallet = useActiveWallet();
    const [userInfo, setUserInfo] = useState({
        email: '',
        walletAddress: '',
        loginTimestamp: '',
        chainUsed: '',
        factoryAddress: ''
    });

    useEffect(() => {
        // Get user info from URL params or localStorage
        const emailFromUrl = router.query.email as string;
        const storedEmail = localStorage.getItem('userEmail');
        const storedWallet = localStorage.getItem('walletAddress');
        const storedTimestamp = localStorage.getItem('loginTimestamp');
        const storedChain = localStorage.getItem('chainUsed');
        const storedFactory = localStorage.getItem('factoryAddress');

        setUserInfo({
            email: emailFromUrl || storedEmail || 'Not available',
            walletAddress: storedWallet || wallet?.getAccount()?.address || 'Not connected',
            loginTimestamp: storedTimestamp || 'Unknown',
            chainUsed: storedChain || 'Unknown',
            factoryAddress: storedFactory || 'Not configured'
        });

        // Log to console for debugging
        console.log("📊 DASHBOARD LOADED");
        console.log("👤 User Email:", emailFromUrl || storedEmail || 'Not available');
        console.log("🔗 Wallet:", storedWallet || wallet?.getAccount()?.address || 'Not connected');
        console.log("⏰ Login Time:", storedTimestamp || 'Unknown');
        console.log("⛓️ Chain:", storedChain || 'Unknown');
        console.log("🏭 Factory:", storedFactory || 'Not configured');

    }, [router.query, wallet]);

    // Loading state
    if (!wallet) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#333',
                backgroundColor: '#ffffff',
                minHeight: '100vh',
                fontFamily: 'Arial, sans-serif'
            }}>
                <div style={{
                    maxWidth: '400px',
                    margin: '0 auto',
                    padding: '30px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '12px',
                    backgroundColor: '#f9f9f9'
                }}>
                    <h2 style={{
                        color: '#d32f2f',
                        marginBottom: '20px',
                        fontSize: '24px',
                        fontWeight: 'bold'
                    }}>
                        🔐 Access Required
                    </h2>
                    <p style={{
                        color: '#666',
                        marginBottom: '25px',
                        fontSize: '16px'
                    }}>
                        Please sign in with your wallet to access the dashboard
                    </p>
                    <button
                        onClick={() => router.push('/SignIn')}
                        style={{
                            backgroundColor: '#1976d2',
                            color: '#ffffff',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'background-color 0.3s'
                        }}
                        onMouseOver={(e) => {
                            const target = e.target as HTMLElement;
                            target.style.backgroundColor = '#1565c0';
                        }}
                        onMouseOut={(e) => {
                            const target = e.target as HTMLElement;
                            target.style.backgroundColor = '#1976d2';
                        }}
                    >
                        Go to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            padding: '20px',
            maxWidth: '800px',
            margin: '0 auto',
            color: '#333',
            backgroundColor: '#ffffff',
            minHeight: '100vh',
            fontFamily: 'Arial, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                textAlign: 'center',
                marginBottom: '30px',
                padding: '20px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                color: '#ffffff'
            }}>
                <h1 style={{
                    margin: '0',
                    fontSize: '32px',
                    fontWeight: 'bold',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}>
                    🎉 Welcome to Web3AIstore Dashboard!
                </h1>
                <p style={{
                    margin: '10px 0 0 0',
                    fontSize: '18px',
                    opacity: '0.9'
                }}>
                    Your AI-powered workspace is ready
                </p>
            </div>

            {/* User Information Section */}
            <div style={{
                background: '#f8f9fa',
                padding: '25px',
                borderRadius: '12px',
                marginBottom: '25px',
                border: '1px solid #e9ecef',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{
                    color: '#2c3e50',
                    marginTop: '0',
                    marginBottom: '20px',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    borderBottom: '2px solid #3498db',
                    paddingBottom: '10px'
                }}>
                    📋 Your Login Information
                </h3>

                <div style={{ display: 'grid', gap: '12px' }}>
                    <p style={{
                        margin: '0',
                        color: '#495057',
                        fontSize: '16px',
                        padding: '8px 0',
                        borderBottom: '1px solid #dee2e6'
                    }}>
                        <strong style={{ color: '#2c3e50', display: 'inline-block', width: '140px' }}>
                            📧 Email:
                        </strong>
                        <span style={{ color: '#27ae60', fontWeight: 'bold' }}>
                            {userInfo.email}
                        </span>
                    </p>

                    <p style={{
                        margin: '0',
                        color: '#495057',
                        fontSize: '14px',
                        padding: '8px 0',
                        borderBottom: '1px solid #dee2e6',
                        wordBreak: 'break-all'
                    }}>
                        <strong style={{ color: '#2c3e50', display: 'inline-block', width: '140px' }}>
                            🔗 Wallet:
                        </strong>
                        <span style={{ color: '#8e44ad', fontFamily: 'monospace' }}>
                            {userInfo.walletAddress}
                        </span>
                    </p>

                    <p style={{
                        margin: '0',
                        color: '#495057',
                        fontSize: '16px',
                        padding: '8px 0',
                        borderBottom: '1px solid #dee2e6'
                    }}>
                        <strong style={{ color: '#2c3e50', display: 'inline-block', width: '140px' }}>
                            ⏰ Login Time:
                        </strong>
                        <span style={{ color: '#e67e22' }}>
                            {new Date(userInfo.loginTimestamp).toLocaleString() || 'Unknown'}
                        </span>
                    </p>

                    <p style={{
                        margin: '0',
                        color: '#495057',
                        fontSize: '16px',
                        padding: '8px 0',
                        borderBottom: '1px solid #dee2e6'
                    }}>
                        <strong style={{ color: '#2c3e50', display: 'inline-block', width: '140px' }}>
                            ⛓️ Chain:
                        </strong>
                        <span style={{ color: '#16a085' }}>
                            {userInfo.chainUsed}
                        </span>
                    </p>

                    <p style={{
                        margin: '0',
                        color: '#495057',
                        fontSize: '14px',
                        padding: '8px 0',
                        wordBreak: 'break-all'
                    }}>
                        <strong style={{ color: '#2c3e50', display: 'inline-block', width: '140px' }}>
                            🏭 Factory:
                        </strong>
                        <span style={{ color: '#34495e', fontFamily: 'monospace' }}>
                            {userInfo.factoryAddress}
                        </span>
                    </p>
                </div>
            </div>

            {/* Features Section */}
            <div style={{
                background: '#ffffff',
                padding: '25px',
                borderRadius: '12px',
                marginBottom: '25px',
                border: '1px solid #e9ecef',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{
                    color: '#2c3e50',
                    marginTop: '0',
                    marginBottom: '20px',
                    fontSize: '20px',
                    fontWeight: 'bold',
                    borderBottom: '2px solid #e74c3c',
                    paddingBottom: '10px'
                }}>
                    🚀 What you can do now:
                </h3>

                <ul style={{
                    listStyle: 'none',
                    padding: '0',
                    margin: '0'
                }}>
                    {[
                        { icon: '🤖', text: 'Access 5,500+ AI tools for productivity', color: '#3498db' },
                        { icon: '💬', text: 'Start with 200 free chats', color: '#2ecc71' },
                        { icon: '📚', text: 'Upload and organize your knowledge base', color: '#9b59b6' },
                        { icon: '⚡', text: 'Create custom AI solutions for your needs', color: '#f39c12' },
                        { icon: '🌐', text: 'Multi-language support for global accessibility', color: '#1abc9c' },
                        { icon: '🔧', text: 'Integrate with your existing workflow', color: '#e67e22' }
                    ].map((item, index) => (
                        <li key={index} style={{
                            margin: '12px 0',
                            padding: '12px 15px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '8px',
                            borderLeft: `4px solid ${item.color}`,
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '16px',
                            color: '#2c3e50'
                        }}>
                            <span style={{
                                fontSize: '20px',
                                marginRight: '12px',
                                display: 'inline-block',
                                width: '30px'
                            }}>
                                {item.icon}
                            </span>
                            <span style={{ fontWeight: '500' }}>
                                {item.text}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Action Buttons */}
            <div style={{
                textAlign: 'center',
                padding: '20px',
                background: '#f8f9fa',
                borderRadius: '12px',
                border: '1px solid #e9ecef'
            }}>
                <button
                    onClick={() => router.push('/app')}
                    style={{
                        backgroundColor: '#28a745',
                        color: '#ffffff',
                        border: 'none',
                        padding: '15px 30px',
                        borderRadius: '8px',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        marginRight: '15px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'all 0.3s'
                    }}
                    onMouseOver={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.backgroundColor = '#218838';
                        target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.backgroundColor = '#28a745';
                        target.style.transform = 'translateY(0)';
                    }}
                >
                    🚀 Launch AI Tools
                </button>

                <button
                    onClick={() => router.push('/SignIn')}
                    style={{
                        backgroundColor: '#6c757d',
                        color: '#ffffff',
                        border: 'none',
                        padding: '15px 30px',
                        borderRadius: '8px',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'all 0.3s'
                    }}
                    onMouseOver={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.backgroundColor = '#5a6268';
                        target.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.backgroundColor = '#6c757d';
                        target.style.transform = 'translateY(0)';
                    }}
                >
                    🔄 Switch Account
                </button>
            </div>
        </div>
    );
};

export default Dashboard;
