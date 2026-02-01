import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { thirdwebClient } from '../util/thirdwebClient';
import type { Account } from 'thirdweb/wallets';

/**
 * Hook that returns thirdweb-compatible account from Auth0 user
 * This account can be used with all thirdweb SDK functions
 */
export function useThirdwebWallet() {
    const { user, isLoading: authLoading } = useUser();
    const [account, setAccount] = useState<Account | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const initializeWallet = async () => {
            if (!user || !user.sub) {
                setAccount(null);
                setAddress(null);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // Check cache first
                const cacheKey = `wallet_${user.sub}`;
                const cachedAddress = localStorage.getItem(cacheKey);

                if (cachedAddress) {
                    console.log('✅ Wallet loaded from cache:', cachedAddress);
                    setAddress(cachedAddress);

                    // Still need to fetch account from API for signing
                    const response = await fetch('/api/user/thirdweb-account');
                    const data = await response.json();

                    if (data.account) {
                        setAccount(data.account);
                    }

                    setIsLoading(false);
                    return;
                }

                // Fetch wallet and create thirdweb account
                console.log('🔄 Initializing thirdweb wallet...');
                const response = await fetch('/api/user/thirdweb-account');

                if (!response.ok) {
                    throw new Error(`Failed to initialize wallet: ${response.statusText}`);
                }

                const data = await response.json();

                if (!data.address) {
                    throw new Error('No wallet address returned');
                }

                console.log('✅ Thirdweb wallet initialized:', data.address);
                setAddress(data.address);
                setAccount(data.account);

                // Cache address
                localStorage.setItem(cacheKey, data.address);
                localStorage.setItem('userWalletAddress', data.address);
            } catch (err) {
                const error = err as Error;
                setError(error);
                console.error('❌ Error initializing wallet:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeWallet();
    }, [user]);

    return {
        account,      // Thirdweb account for signing transactions
        address,      // Wallet address
        isLoading: authLoading || isLoading,
        error,
        user,
        client: thirdwebClient, // Export client for convenience
    };
}

/**
 * Drop-in replacement for thirdweb's useActiveAccount
 * Compatible with your existing code
 */
export function useActiveAccount() {
    const { account, address, isLoading, error, user, client } = useThirdwebWallet();

    return {
        account: address ? { address } : null,
        isLoading,
        error,
        user,
        client,
    };
}

/**
 * Get thirdweb account for server-side operations
 * Use this for signing transactions on behalf of users
 */
export function useThirdwebAccount() {
    const { account, address, isLoading, error } = useThirdwebWallet();

    return {
        account,
        address,
        isLoading,
        error,
    };
}
