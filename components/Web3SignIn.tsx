// components/Web3SignIn.tsx - UPDATED WITH DYNAMIC RETURN URL

import React from "react";
import { useRouter } from 'next/router';
import { LocalizedText } from '../util/LocalizedText';
import styles from "../styles/Signin.module.css";

/**
 * Web3SignIn Component
 * 
 * Auth0 social login with dynamic return URL
 * After login, redirects back to the page user came from
 */

interface Web3SignInProps {
    className?: string;
    onClose?: () => void;
    showCloseButton?: boolean;
    title?: string;
    subtitle?: string;
    returnTo?: string; // Optional: specify custom return URL
}

const Web3SignIn: React.FC<Web3SignInProps> = ({
    className,
    onClose,
    showCloseButton = false,
    title = "Sign in to Continue",
    subtitle = "Choose your preferred login method",
    returnTo // If provided, use this; otherwise use current page
}) => {
    const router = useRouter();

    // Get current page path for return URL
    const getReturnUrl = () => {
        if (returnTo) return returnTo;

        // If we're on test-notebook-manager page, return there after login
        if (router.pathname.includes('test-notebook-manager')) {
            return '/test-notebook-manager';
        }

        // Otherwise return to current page or home
        return router.pathname || '/';
    };

    /**
     * Direct Auth0 social login with return URL
     */
    const handleSocialLogin = (connection: string) => {
        const returnUrl = getReturnUrl();
        console.log('🔐 Auth0 Login:', connection);
        console.log('📍 Return to:', returnUrl);

        const authUrl = `/api/auth/login?connection=${connection}&returnTo=${encodeURIComponent(returnUrl)}&prompt=login`;
        window.location.href = authUrl;
    };

    /**
     * Email/password login with return URL
     */
    const handleEmailLogin = () => {
        const returnUrl = getReturnUrl();
        console.log('📧 Email Login');
        console.log('📍 Return to:', returnUrl);

        const authUrl = `/api/auth/login?returnTo=${encodeURIComponent(returnUrl)}`;
        window.location.href = authUrl;
    };

    return (
        <div className={className || styles.signInContainer}>
            {/* Header Section */}
            {showCloseButton && onClose && (
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer',
                        color: '#fff',
                    }}
                    aria-label="Close"
                >
                    ×
                </button>
            )}

            {/* Title */}
            <h2 style={{
                textAlign: 'center',
                marginBottom: '10px',
                fontSize: '32px',
                fontWeight: '700',
                color: '#fff',
            }}>
                {title}
            </h2>

            {/* Subtitle */}
            {subtitle && (
                <p style={{
                    textAlign: 'center',
                    marginBottom: '30px',
                    fontSize: '16px',
                    color: '#ccc',
                }}>
                    {subtitle}
                </p>
            )}

            {/* Auth0 Login Buttons Section */}
            <div style={{
                width: '100%',
                maxWidth: '500px',
                margin: '0 auto',
                padding: '20px',
            }}>
                {/* Google Login */}
                <button
                    onClick={() => handleSocialLogin('google-oauth2')}
                    style={{
                        width: '100%',
                        padding: '16px 24px',
                        fontSize: '18px',
                        fontWeight: '600',
                        background: '#fff',
                        color: '#1f1f1f',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <span style={{ fontSize: '24px' }}>🔵</span>
                    <LocalizedText name="Continue with Google" />
                </button>

                {/* Apple Login */}
                <button
                    onClick={() => handleSocialLogin('apple')}
                    style={{
                        width: '100%',
                        padding: '16px 24px',
                        fontSize: '18px',
                        fontWeight: '600',
                        background: '#000',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <span style={{ fontSize: '24px' }}>🍎</span>
                    <LocalizedText name="Continue with Apple" />
                </button>

                {/* Facebook Login */}
                <button
                    onClick={() => handleSocialLogin('facebook')}
                    style={{
                        width: '100%',
                        padding: '16px 24px',
                        fontSize: '18px',
                        fontWeight: '600',
                        background: '#1877f2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(24,119,242,0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <span style={{ fontSize: '24px' }}>📘</span>
                    <LocalizedText name="Continue with Facebook" />
                </button>

                {/* LINE Login */}
                <button
                    onClick={() => handleSocialLogin('line')}
                    style={{
                        width: '100%',
                        padding: '16px 24px',
                        fontSize: '18px',
                        fontWeight: '600',
                        background: '#00B900',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,185,0,0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <span style={{ fontSize: '24px' }}>💚</span>
                    <LocalizedText name="Continue with LINE" />
                </button>

                {/* Microsoft Login */}
                <button
                    onClick={() => handleSocialLogin('windowslive')}
                    style={{
                        width: '100%',
                        padding: '16px 24px',
                        fontSize: '18px',
                        fontWeight: '600',
                        background: '#00a4ef',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,164,239,0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <span style={{ fontSize: '24px' }}>🪟</span>
                    <LocalizedText name="Continue with Microsoft" />
                </button>

                {/* Divider */}
                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                    <span style={{ color: '#888', fontSize: '14px' }}>
                        <LocalizedText name="OR" />
                    </span>
                </div>

                {/* Email Login */}
                <button
                    onClick={handleEmailLogin}
                    style={{
                        width: '100%',
                        padding: '16px 24px',
                        fontSize: '18px',
                        fontWeight: '600',
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <span style={{ fontSize: '24px' }}>📧</span>
                    <LocalizedText name="Continue with Email" />
                </button>

                {/* Info Text */}
                <p style={{
                    marginTop: '20px',
                    textAlign: 'center',
                    fontSize: '12px',
                    color: '#999',
                }}>
                    <LocalizedText name="By signing in, you agree to our Terms of Service and Privacy Policy" />
                </p>
            </div>
        </div>
    );
};

export default Web3SignIn;
