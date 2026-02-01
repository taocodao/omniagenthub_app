/**
 * Smart Fetch Hook
 * 
 * Wrapper that routes between:
 * - Admin mode (free access with X-Admin-Key header)
 * - WEBAI Credits mode (pay with WEBAI Credits from KV balance)
 * - Payment mode (USDC/WEBAI via x402Fetch)
 * 
 * Controlled by environment variables:
 * - NEXT_PUBLIC_PAYMENT_ENABLED: 'true' or 'false'
 * - NEXT_PUBLIC_ADMIN_KEY: Secret key for admin bypass
 * - NEXT_PUBLIC_PAYMENT_MODE: 'webai' | 'usdc' | 'both' (defaults to 'webai')
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useX402Fetch } from './useX402Fetch';

// Check if payment is enabled (defaults to true for safety)
const PAYMENT_ENABLED = process.env.NEXT_PUBLIC_PAYMENT_ENABLED !== 'false';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY || '';
const DEFAULT_PAYMENT_MODE = process.env.NEXT_PUBLIC_PAYMENT_MODE || 'both'; // 'webai' | 'usdc' | 'both'

// Helper to get user's preferred payment mode from localStorage
const getPaymentMode = (): 'webai' | 'usdc' | 'both' => {
    if (typeof window === 'undefined') return DEFAULT_PAYMENT_MODE as 'webai' | 'usdc' | 'both';
    const stored = localStorage.getItem('preferredPaymentMode');
    if (stored && ['webai', 'usdc', 'both'].includes(stored)) {
        return stored as 'webai' | 'usdc' | 'both';
    }
    return DEFAULT_PAYMENT_MODE as 'webai' | 'usdc' | 'both';
};

interface SmartFetchOptions extends RequestInit {
    // Price for this request (in USD)
    price?: number;
    // MCP server URL (for payment tracking)
    mcpServerUrl?: string;
}

interface WebaiCreditsBalance {
    balance: number;
    balanceUsd: number;
}

export function useSmartFetch() {
    // Get the payment-enabled fetch
    const { fetch: x402Fetch, isReady: x402Ready, userWallet } = useX402Fetch();

    // Track user's preferred payment mode
    const [paymentMode, setPaymentModeState] = useState<'webai' | 'usdc' | 'both'>(getPaymentMode);

    // Function to update payment mode preference (saves to localStorage)
    const setPaymentMode = useCallback((mode: 'webai' | 'usdc' | 'both') => {
        setPaymentModeState(mode);
        if (typeof window !== 'undefined') {
            localStorage.setItem('preferredPaymentMode', mode);
        }
    }, []);

    // Track WEBAI Credits balance
    const [webaiBalance, setWebaiBalance] = useState<WebaiCreditsBalance | null>(null);

    // Fetch WEBAI Credits balance
    const fetchWebaiBalance = useCallback(async (userAddress: string): Promise<WebaiCreditsBalance> => {
        try {
            const response = await fetch('/api/mcp/balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress }),
            });
            const data = await response.json();
            if (data.success) {
                const balance = { balance: data.balance, balanceUsd: data.balanceUsd };
                setWebaiBalance(balance);
                return balance;
            }
            return { balance: 0, balanceUsd: 0 };
        } catch (error) {
            console.error('Error fetching WEBAI balance:', error);
            return { balance: 0, balanceUsd: 0 };
        }
    }, []);

    // Admin fetch - bypasses payment using admin key
    const adminFetch = useCallback(async (url: string, options: SmartFetchOptions = {}): Promise<Response> => {
        const headers = new Headers(options.headers);

        // Add admin key for payment bypass
        if (ADMIN_KEY) {
            headers.set('X-Admin-Key', ADMIN_KEY);
        }

        // Add wallet address if available (for user identification)
        const walletAddress = typeof window !== 'undefined'
            ? localStorage.getItem('walletAddress')
            : null;
        if (walletAddress) {
            headers.set('X-Wallet-Address', walletAddress);
        }

        console.log('🔓 Admin fetch (payment bypassed):', url);

        return fetch(url, {
            ...options,
            headers,
        });
    }, []);

    // WEBAI Credits payment fetch
    const webaiFetch = useCallback(async (url: string, options: SmartFetchOptions = {}): Promise<Response> => {
        // Use wallet address from the Privy hook, not localStorage
        if (!userWallet) {
            console.error('❌ No wallet address found for WEBAI payment');
            throw new Error('Wallet address required for WEBAI payment');
        }

        const price = options.price || 0.01; // Default 1 credit = $0.01
        const mcpServerUrl = options.mcpServerUrl || url;

        console.log('💳 WEBAI Credits fetch:', { url, price, walletAddress: userWallet });

        // First, pay with WEBAI Credits
        const paymentResponse = await fetch('/api/mcp/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userAddress: userWallet,
                mcpServerUrl,
                price,
            }),
        });

        const paymentData = await paymentResponse.json();

        if (!paymentData.success) {
            console.error('❌ WEBAI payment failed:', paymentData.message);



            throw new Error(paymentData.message);
        }

        console.log('✅ WEBAI payment successful. Remaining credits:', paymentData.remainingCredits);

        // Update local balance
        setWebaiBalance({
            balance: paymentData.remainingCredits,
            balanceUsd: paymentData.remainingCredits * 0.01
        });

        // Now make the actual request with auth token
        const headers = new Headers(options.headers);
        headers.set('X-Wallet-Address', userWallet);
        if (paymentData.authToken) {
            headers.set('X-Payment-Auth', paymentData.authToken);
        }
        headers.set('X-Payment-Method', 'webai_credits');

        // Dispatch event to refresh UI
        window.dispatchEvent(new CustomEvent('refreshWebaiCredits'));

        return fetch(url, {
            ...options,
            headers,
        });
    }, [userWallet, x402Fetch]);

    // Smart fetch - routes based on payment mode setting
    const smartFetch = useCallback(async (url: string, options: SmartFetchOptions = {}): Promise<Response> => {
        if (!PAYMENT_ENABLED) {
            // Payment disabled - use admin fetch with bypass key
            return adminFetch(url, options);
        }

        // Payment enabled - route based on payment mode
        switch (paymentMode) {
            case 'webai':
                return webaiFetch(url, options);

            case 'usdc':
                if (!x402Fetch) {
                    console.warn('⚠️ x402Fetch not ready, falling back to regular fetch');
                    return fetch(url, options);
                }
                return x402Fetch(url, options);

            case 'both':
            default:
                // Try WEBAI Credits first, fall back to USDC
                console.log('💳 smartFetch: paymentMode=both, userWallet=', userWallet || 'NULL');
                try {
                    return await webaiFetch(url, options);
                } catch (error: any) {
                    console.log('📤 WEBAI failed, reason:', error?.message || error);
                    console.log('📤 Falling back to USDC (x402Fetch)...');
                    if (x402Fetch) {
                        return x402Fetch(url, options);
                    }
                    throw error;
                }
        }
    }, [adminFetch, webaiFetch, x402Fetch, paymentMode]);

    // Check if ready to make requests
    // CRITICAL: For 'webai' or 'both' modes, we MUST wait for userWallet to be available
    // Otherwise the first request will fail and fall back to crypto signature
    const isReady = useMemo(() => {
        if (!PAYMENT_ENABLED) {
            return true; // Admin mode is always ready
        }
        if (paymentMode === 'usdc') {
            return x402Ready;
        }
        // For 'webai' or 'both' modes, require userWallet to be available
        if (paymentMode === 'webai' || paymentMode === 'both') {
            return !!userWallet; // Wait for wallet from Privy
        }
        return true;
    }, [x402Ready, paymentMode, userWallet]);

    return {
        smartFetch,
        isReady,
        paymentEnabled: PAYMENT_ENABLED,
        paymentMode,
        setPaymentMode,
        isAdminMode: !PAYMENT_ENABLED,
        userWallet,
        webaiBalance,
        fetchWebaiBalance,
    };
}

// Export as default for easy import
export default useSmartFetch;

