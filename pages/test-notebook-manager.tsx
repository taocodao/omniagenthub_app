/* eslint-disable react/no-unescaped-entities */

// pages/test-notebook-manager.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import NotebookManager from '../components/NotebookManager';
import Web3SignIn from '../components/Web3SignIn';
import { useActiveAccount } from '../hooks/useWalletAddress';

const TestNotebookManager: React.FC = () => {
  const router = useRouter();
  const { account, isLoading } = useActiveAccount();
  const userAddress = account?.address;

  // State management
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Track if user clicked the button (important!)
  const buttonClickedRef = useRef(false);
  // Track previous address to detect new login
  const prevAddressRef = useRef<string | null>(null);

  /**
   * ONLY auto-open modal after login IF user clicked the button
   */
  useEffect(() => {
    // Don't do anything while loading
    if (isLoading) return;

    // Check if user just got an address (just logged in)
    const justLoggedIn = !prevAddressRef.current && userAddress;

    // ONLY open modal if:
    // 1. User just logged in (address appeared)
    // 2. User had previously clicked the button
    if (justLoggedIn && buttonClickedRef.current) {
      console.log('✅ Login successful, opening NotebookManager modal');
      console.log('📍 User address:', userAddress);

      // Auto-open the NotebookManager modal
      setIsModalOpen(true);
      setShowLoginModal(false);

      // Reset the button clicked flag
      buttonClickedRef.current = false;

      // Show success toast
      toast.success('🎉 Login successful! Opening NotebookManager...', {
        position: 'top-center',
        autoClose: 3000,
      });
    }

    // Update previous address reference
    prevAddressRef.current = userAddress || null;

  }, [userAddress, isLoading]);

  /**
   * Handle "Open NotebookManager" button click
   * This is the ONLY way to trigger the flow
   */
  const handleOpenNotebook = () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔘 Open NotebookManager Button Clicked');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Current address:', userAddress || 'null');
    console.log('   Loading:', isLoading);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Don't proceed if still loading
    if (isLoading) {
      toast.info('⏳ Checking authentication...', {
        position: 'top-center',
        autoClose: 2000,
      });
      return;
    }

    // Set flag that user clicked the button
    buttonClickedRef.current = true;

    if (userAddress) {
      // User IS logged in → Open NotebookManager directly
      console.log('✅ User authenticated, opening NotebookManager modal');
      setIsModalOpen(true);
      setShowLoginModal(false);
    } else {
      // User NOT logged in → Show login modal
      console.log('❌ No address found, showing login modal');
      setShowLoginModal(true);
      setIsModalOpen(false);
    }
  };

  /**
   * Handle closing the login modal
   */
  const handleCloseLogin = () => {
    console.log('🚫 Login modal closed by user');
    setShowLoginModal(false);
    buttonClickedRef.current = false; // Reset flag
  };

  /**
   * Handle closing the NotebookManager modal
   */
  const handleCloseNotebook = () => {
    console.log('🚫 NotebookManager modal closed');
    setIsModalOpen(false);
    buttonClickedRef.current = false; // Reset flag
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <ToastContainer />

      {/* Main Container */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
        padding: '40px',
        maxWidth: '600px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Header */}
        <h1 style={{
          fontSize: '32px',
          marginBottom: '16px',
          color: '#333',
          fontWeight: '700',
        }}>
          📚 NotebookManager Test
        </h1>

        <p style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '32px',
          lineHeight: '1.6',
        }}>
          Click the button below to open the NotebookManager.
          {!userAddress && ' You will be prompted to login first.'}
        </p>

        {/* User Status Display */}
        {isLoading ? (
          <div style={{
            padding: '16px',
            backgroundColor: '#f0f0f0',
            borderRadius: '8px',
            marginBottom: '24px',
          }}>
            <p style={{ color: '#666', margin: 0 }}>
              ⏳ Checking authentication...
            </p>
          </div>
        ) : userAddress ? (
          <div style={{
            padding: '16px',
            backgroundColor: '#e8f5e9',
            borderRadius: '8px',
            marginBottom: '24px',
            border: '1px solid #4caf50',
          }}>
            <p style={{ color: '#2e7d32', margin: 0, fontWeight: '600' }}>
              ✅ Connected
            </p>
            <p style={{
              color: '#666',
              margin: '8px 0 0 0',
              fontSize: '12px',
              wordBreak: 'break-all',
            }}>
              {userAddress}
            </p>
          </div>
        ) : (
          <div style={{
            padding: '16px',
            backgroundColor: '#fff3e0',
            borderRadius: '8px',
            marginBottom: '24px',
            border: '1px solid #ff9800',
          }}>
            <p style={{ color: '#f57c00', margin: 0 }}>
              ⚠️ Not connected - Login required
            </p>
          </div>
        )}

        {/* Open NotebookManager Button */}
        <button
          onClick={handleOpenNotebook}
          disabled={isLoading}
          style={{
            backgroundColor: isLoading ? '#ccc' : '#1976d2',
            color: 'white',
            border: 'none',
            padding: '16px 32px',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease',
            width: '100%',
            maxWidth: '300px'
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#1565c0';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
            }
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#1976d2';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }
          }}
        >
          {isLoading ? '⏳ Loading...' : '🚀 Open NotebookManager'}
        </button>

        {/* Status Info */}
        <div style={{
          marginTop: '24px',
          padding: '12px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
        }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#666',
          }}>
            <strong>Status:</strong> {
              isLoading ? '⏳ Loading...' :
                isModalOpen ? '🟢 Notebook Open' :
                  showLoginModal ? '🔐 Login Required' :
                    '⚪ Ready'
            }
          </p>
        </div>

        {/* Info Box */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '1px solid #2196f3',
        }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#1976d2',
            lineHeight: '1.6',
          }}>
            ℹ️ <strong>How it works:</strong><br />
            • Click button → Check if logged in<br />
            • If logged in → Modal opens immediately<br />
            • If not logged in → Login screen appears<br />
            • After login → Modal opens automatically
          </p>
        </div>
      </div>

      {/* Login Modal - Only shows when triggered by button click */}
      {showLoginModal && !userAddress && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            backgroundColor: '#1f1f1f',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '500px',
            width: '90%',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            {/* Close Button */}
            <button
              onClick={handleCloseLogin}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                fontSize: '28px',
                cursor: 'pointer',
                color: '#fff',
                lineHeight: '1',
                zIndex: 10,
              }}
              aria-label="Close"
            >
              ×
            </button>

            {/* Web3SignIn Component */}
            <Web3SignIn
              returnTo="/test-notebook-manager"
              title="Login Required"
              subtitle="Sign in to access NotebookManager"
              showCloseButton={false}
              onClose={handleCloseLogin}
            />
          </div>
        </div>
      )}

      {/* NotebookManager Modal - Only opens when authenticated */}
      {isModalOpen && userAddress && (
        <NotebookManager
          isOpen={isModalOpen}
          onClose={handleCloseNotebook}
          userAddress={userAddress}
          language="en"
        />
      )}
    </div>
  );
};

export default TestNotebookManager;
