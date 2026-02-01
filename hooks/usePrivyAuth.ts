// hooks/usePrivyAuth.ts
/**
 * Privy-based authentication hook
 * Replaces the Auth0-based useWalletAddress hook
 * Uses Privy's embedded wallet as the user's wallet address
 */

import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

interface ActiveAccount {
    address: string;
}

interface UseActiveAccountResult {
    account: ActiveAccount | null;
    isLoading: boolean;
    error: Error | null;
    user: any;
    authenticated: boolean;
    login: () => void;
    logout: () => Promise<void>;
}

/**
 * Custom hook that gets wallet address from Privy user
 * Returns the embedded wallet address directly from Privy
 */
export function useActiveAccount(): UseActiveAccountResult {
    const { ready, authenticated, user, login, logout } = usePrivy();
    const { wallets } = useWallets();
    const [error, setError] = useState<Error | null>(null);

    // Debug logging
    useEffect(() => {
        if (ready) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🔐 useActiveAccount (Privy) Hook Called');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('   ready:', ready);
            console.log('   authenticated:', authenticated);
            console.log('   userId:', user?.id);
            console.log('   wallets count:', wallets.length);

            if (wallets.length > 0) {
                wallets.forEach((w, i) => {
                    console.log(`   wallet[${i}]:`, w.address, '- type:', w.walletClientType);
                });
            }
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        }
    }, [ready, authenticated, user, wallets]);

    // Get embedded wallet address
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
    const externalWallet = wallets[0]; // Fallback to first connected wallet
    const activeWallet = embeddedWallet || externalWallet;
    const address = activeWallet?.address || null;

    // Sync address to localStorage for compatibility with legacy hooks (useSmartFetch)
    useEffect(() => {
        if (address) {
            localStorage.setItem('walletAddress', address);
            localStorage.setItem('userAddress', address); // Set both keys for compatibility
        } else if (ready && !authenticated) {
            // Only clear if ready and definitely not authenticated
            localStorage.removeItem('walletAddress');
            localStorage.removeItem('userAddress');
        }
    }, [address, ready, authenticated]);

    const isLoading = !ready;

    return {
        account: address ? { address } : null,
        isLoading,
        error,
        user,
        authenticated,
        login,
        logout,
    };
}

/**
 * Simplified hook for just getting the wallet address
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
 * Hook to get the Privy user ID
 * Useful for database lookups
 */
export function usePrivyUserId() {
    const { user, ready } = usePrivy();
    return {
        userId: user?.id || null,
        isLoading: !ready,
    };
}

export default useActiveAccount;
