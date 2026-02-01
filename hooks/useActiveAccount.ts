import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

/**
 * Custom hook that replaces thirdweb's useActiveAccount
 * Returns wallet address generated from Auth0 user ID
 * 
 * This hook checks for wallet address in this order:
 * 1. Auth0 session (set during callback)
 * 2. localStorage cache
 * 3. API endpoint (/api/user/wallet)
 * 
 * This makes all thirdweb code and ConnectEmbed work with Auth0 authentication
 */
export function useActiveAccount() {
    const { user, isLoading: authLoading, error: authError } = useUser();
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchWallet = async () => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔍 useActiveAccount - Wallet Fetch Started');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 State:', {
                authLoading,
                hasUser: !!user,
                userId: user?.sub,
                userEmail: user?.email,
                authError: authError?.message,
            });

            // Wait for Auth0 to finish loading
            if (authLoading) {
                console.log('⏳ Auth0 still loading, waiting...');
                setIsLoading(true);
                return;
            }

            // Handle Auth0 errors
            if (authError) {
                console.error('❌ Auth0 error:', authError);
                setError(authError);
                setIsLoading(false);
                return;
            }

            // No user authenticated
            if (!user || !user.sub) {
                console.log('❌ No user authenticated');
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
                setWalletAddress(null);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                console.log('✅ User authenticated:', user.sub);

                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // Strategy 1: Check if wallet is in Auth0 session
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                const userWithWallet = user as any;
                if (userWithWallet.walletAddress) {
                    console.log('✅ Wallet found in Auth0 session');
                    console.log('   Address:', userWithWallet.walletAddress);
                    console.log('   Source: Auth0 Session (from callback)');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                    setWalletAddress(userWithWallet.walletAddress as string);

                    // Cache in localStorage for faster subsequent loads
                    const cacheKey = `wallet_${user.sub}`;
                    localStorage.setItem(cacheKey, userWithWallet.walletAddress);

                    setIsLoading(false);
                    return;
                }

                console.log('⚠️  Wallet not in session, checking cache...');

                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // Strategy 2: Check localStorage cache
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                const cacheKey = `wallet_${user.sub}`;
                const cachedAddress = localStorage.getItem(cacheKey);

                if (cachedAddress) {
                    console.log('✅ Wallet found in localStorage cache');
                    console.log('   Address:', cachedAddress);
                    console.log('   Source: localStorage');
                    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                    setWalletAddress(cachedAddress);
                    setIsLoading(false);
                    return;
                }

                console.log('⚠️  Wallet not in cache, fetching from API...');

                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                // Strategy 3: Fetch from API endpoint
                // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                console.log('🔄 Fetching wallet from /api/user/wallet...');
                const response = await fetch('/api/user/wallet', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API error (${response.status}): ${errorText}`);
                }

                const data = await response.json();

                if (!data.address) {
                    throw new Error('No wallet address returned from API');
                }

                console.log('✅ Wallet fetched from API');
                console.log('   Address:', data.address);
                console.log('   Source: /api/user/wallet');
                console.log('   User ID:', data.userId);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                setWalletAddress(data.address);

                // Cache for next time
                localStorage.setItem(cacheKey, data.address);

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('❌ Error fetching wallet:');
                console.error('   Error:', errorMessage);
                console.error('   User ID:', user?.sub);
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWallet();
    }, [user, authLoading, authError]); // ✅ All dependencies included

    // Final state logging
    useEffect(() => {
        if (!authLoading && !isLoading) {
            console.log('📋 useActiveAccount - Final State:', {
                hasWallet: !!walletAddress,
                address: walletAddress,
                isLoading: false,
                hasError: !!error,
                errorMessage: error?.message,
            });
        }
    }, [walletAddress, authLoading, isLoading, error]);

    // Return in thirdweb's format
    return {
        account: walletAddress ? { address: walletAddress } : null,
        isLoading: authLoading || isLoading,
        error,
    };
}

/**
 * Alternative hook with simpler return format
 * Just returns { address, isLoading, error }
 */
export function useWalletAddress() {
    const { account, isLoading, error } = useActiveAccount();

    return {
        address: account?.address || null,
        isLoading,
        error,
    };
}

/**
 * Hook to get user info along with wallet
 */
export function useAuth() {
    const { user, isLoading: authLoading, error: authError } = useUser();
    const { account, isLoading: walletLoading, error: walletError } = useActiveAccount();

    return {
        user,
        address: account?.address || null,
        isLoading: authLoading || walletLoading,
        error: authError || walletError,
        isAuthenticated: !!user,
        hasWallet: !!account?.address,
    };
}
