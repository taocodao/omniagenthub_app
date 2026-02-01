// pages/_app.tsx
import React from 'react';
import { AppProps } from "next/app";
import "../styles/globals.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// REMOVED: Auth0 UserProvider - Migrated to Privy
// import { UserProvider } from '@auth0/nextjs-auth0/client';
import { SharedProvider } from "../context/SharedContext";
import { LocalizationProvider } from '../util/LocalizationContext';
import { ThirdwebProvider } from "thirdweb/react"; // From thirdweb/react
import { inAppWallet } from "thirdweb/wallets";
import { polygonAmoy, polygon, Chain } from "thirdweb/chains";
import { ACTIVE_CHAIN, ACCOUNT_FACTORY_ADDRESS } from "../constants/constants";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { ChatModalProvider } from "../context/ChatModalContext";
import { MarketingChatModalProvider } from '../context/MarketingChatModalContext';
import { BusinessChatModalProvider } from '../context/BusinessChatModalContext';
import { PrivyProvider } from '../context/PrivyContext';
import Script from 'next/script';

/**
 * Initialize React Query Client
 * Configured for optimal performance and caching
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

/**
 * Mapping of chain identifiers to Chain objects
 */
const chainMap: { [key: string]: Chain } = {
  "polygon-amoy-testnet": polygonAmoy,
  "polygon": polygon, // Polygon mainnet
};

/**
 * Select the active chain based on the ACTIVE_CHAIN constant
 * Fallback to Polygon mainnet if ACTIVE_CHAIN is undefined
 */
const activeChain: Chain = chainMap[ACTIVE_CHAIN] || polygon;

/**
 * Define available wallets
 */
const wallets = [inAppWallet()];

/**
 * Main App Component
 * 
 * Provider Hierarchy:
 * 1. QueryClientProvider - React Query for data fetching
 * 2. PrivyProvider - Privy authentication with embedded wallets (MIGRATED FROM AUTH0)
 * 3. ThirdwebProvider - Thirdweb for blockchain operations
 * 4. SharedProvider - Application shared state
 * 5. LocalizationProvider - Internationalization
 * 6. ChatModalProvider - Main chat modal state
 * 7. MarketingChatModalProvider - Marketing chat modal state
 * 8. BusinessChatModalProvider - Business chat modal state
 */
const MyApp = ({ Component, pageProps }: AppProps) => {
  const isProduction = process.env.NODE_ENV === 'production';

  return (
    <QueryClientProvider client={queryClient}>
      {/* ✅ Privy Provider - Primary authentication (migrated from Auth0) */}
      <PrivyProvider>
        {/* ThirdwebProvider configured with activeChain and wallets */}
        <ThirdwebProvider>
          <SharedProvider>
            <LocalizationProvider>
              {/* Microsoft UET (Universal Event Tracking) Script - Production Only */}
              {isProduction && (
                <Script
                  id="uet-tag"
                  strategy="afterInteractive"
                  dangerouslySetInnerHTML={{
                    __html: `
                      (function(w,d,t,r,u){
                        var f,n,i;
                        w[u]=w[u]||[];
                        f=function(){
                          var o={ti:"97152802", enableAutoSpaTracking: true};
                          o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")
                        },
                        n=d.createElement(t),
                        n.src=r,
                        n.async=1,
                        n.onload=n.onreadystatechange=function(){
                          var s=this.readyState;
                          if(s && s!=="loaded" && s!=="complete") return;
                          f(), n.onload=n.onreadystatechange=null
                        },
                        i=d.getElementsByTagName(t)[0],
                        i.parentNode.insertBefore(n,i)
                      })(window,document,"script","//bat.bing.com/bat.js","uetq");
                    `,
                  }}
                />
              )}

              {/* Wrap the application with all Chat Modal Providers */}
              <ChatModalProvider>
                <MarketingChatModalProvider>
                  <BusinessChatModalProvider>
                    {/* Main Application Component */}
                    <Component {...pageProps} />

                    {/* Global Toast Notification Container */}
                    <ToastContainer
                      position="top-center"
                      autoClose={4000} // 4 seconds
                      hideProgressBar={false}
                      newestOnTop={true}
                      closeOnClick={true}
                      rtl={false}
                      pauseOnFocusLoss={false}
                      draggable={true}
                      pauseOnHover={false}
                      theme="colored"
                    />
                  </BusinessChatModalProvider>
                </MarketingChatModalProvider>
              </ChatModalProvider>
            </LocalizationProvider>
          </SharedProvider>
        </ThirdwebProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
};

export default MyApp;
