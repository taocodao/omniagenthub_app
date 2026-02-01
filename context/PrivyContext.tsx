// context/PrivyContext.tsx
'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { PrivyProvider as PrivyBaseProvider } from '@privy-io/react-auth';
import { base } from 'viem/chains';

interface PrivyContextValue {
    isReady: boolean;
}

const PrivyContext = createContext<PrivyContextValue>({ isReady: false });

export const usePrivyContext = () => useContext(PrivyContext);

interface PrivyProviderProps {
    children: ReactNode;
}

export const PrivyProvider: React.FC<PrivyProviderProps> = ({ children }) => {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

    if (!appId) {
        console.warn('NEXT_PUBLIC_PRIVY_APP_ID is not set');
        return <>{children}</>;
    }

    return (
        <PrivyBaseProvider
            appId={appId}
            config={{
                // Login methods - Email, SMS, Google only
                loginMethods: ['email', 'sms', 'google'],

                // Embedded wallet configuration
                // Embedded wallet configuration (v3.10.0+ requires nested ethereum object)
                embeddedWallets: {
                    ethereum: {
                        createOnLogin: 'users-without-wallets',
                    },
                },

                // Default to Base chain for USDC payments
                defaultChain: base,
                supportedChains: [base],

                // Appearance - custom logo
                appearance: {
                    theme: 'dark',
                    accentColor: '#7c3aed', // Purple accent
                    logo: '/images/omniagenthub_logo.jpeg',
                    showWalletLoginFirst: false,
                },
            }}
        >
            <PrivyContext.Provider value={{ isReady: true }}>
                {children}
            </PrivyContext.Provider>
        </PrivyBaseProvider>
    );
};

export default PrivyProvider;
