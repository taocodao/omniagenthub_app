import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useActiveAccount } from '../hooks/useWalletAddress';
import SignIn from '../components/SignIn';
import ChatHome from './ChatHome_new';
import ShopHome from './shop_business'
import ChatHome_Bus from './ChatHome_bus'

const IndexPage: React.FC = () => {
  const router = useRouter();
  const { account, isLoading } = useActiveAccount();
  const [mounted, setMounted] = useState(false);

  const address = account?.address;

  // Wait for client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Debug logging
  useEffect(() => {
    if (mounted) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🏠 INDEX PAGE');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   mounted:', mounted);
      console.log('   isLoading:', isLoading);
      console.log('   hasAddress:', !!address);
      console.log('   address:', address);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  }, [mounted, isLoading, address]);

  // Handle promoteCode query parameter for email promo links
  useEffect(() => {
    const handlePromoCode = async () => {
      if (!router.isReady || !address) return;

      const promoteCode = router.query.promoteCode as string;
      if (!promoteCode) return;

      console.log('🎁 Promo code detected:', promoteCode);

      // Store promo code in localStorage to apply after login
      localStorage.setItem('pendingPromoCode', promoteCode);

      // If user is logged in, apply the promo immediately
      try {
        const response = await fetch('/api/proxy-add-webai-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userKey: address,
            webaiCredits: Number(process.env.NEXT_PUBLIC_EMAIL_PROMO_BONUS) || 20,
            promoCodeUsed: promoteCode,
            setMode: true, // Promo takes priority - SET credits instead of adding
          }),
        });

        const data = await response.json();
        if (data.success) {
          console.log('✅ Promo bonus applied:', data);
          // Clean the URL
          router.replace('/', undefined, { shallow: true });
        } else {
          console.log('⚠️ Promo code already used or invalid:', data.message);
        }
      } catch (error) {
        console.error('Error applying promo code:', error);
      }
    };

    handlePromoCode();
  }, [router.isReady, router.query.promoteCode, address]);

  // Show loading during SSR or while checking auth
  if (!mounted || isLoading) {
    console.log('⏳ Showing loading...');
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: '20px',
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #f3f3f3',
          borderTop: '5px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}></div>
        <div>Loading...</div>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Not authenticated
  if (!address) {
    console.log('❌ Not authenticated, showing SignIn');
    return (
      <>
        <Head>
          <title>OmniAgentHub - Sign In</title>
          <meta name="description" content="Sign in to OmniAgentHub" />
        </Head>
        <SignIn />
      </>
    );
  }

  // Authenticated!
  console.log('✅ Authenticated, showing ChatHome');
  return (
    <>
      <Head>
        <title>OmniAgentHub - AI Chat</title>
        <meta name="description" content="AI-powered productivity platform" />
      </Head>
      <ChatHome />
    </>
  );
};

export default IndexPage;
