/**
 * MANUAL X402 IMPLEMENTATION
 * 
 * This bypasses the buggy @x402/evm library and implements X402 payment
 * directly with Privy's embedded wallet using EIP-3009 TransferWithAuthorization.
 * 
 * Created after 4+ hours debugging @x402/evm "invalid BigInt syntax" errors.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useWallets, useSignTypedData } from '@privy-io/react-auth';

// NEXT_PUBLIC_CONFIG_ENV=dev -> Base Sepolia (chainId: 84532), otherwise -> Base mainnet (chainId: 8453)
const isDev = process.env.NEXT_PUBLIC_CONFIG_ENV === 'dev';
const chainId = isDev ? 84532 : 8453;

console.log('🔷 useX402FetchManual: Module loaded, isDev=', isDev, 'chainId=', chainId);

// EIP-3009 TransferWithAuthorization types
const EIP3009_TYPES = {
    TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
    ]
};

// Generate random nonce
function generateNonce(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Parse payment requirements from 402 response
interface PaymentRequirements {
    x402Version: number;
    accepts: Array<{
        network: string;
        scheme: string;
        payTo: string;
        asset: string;
        maxAmountRequired: string;
        extra: {
            name: string;
            version: string;
        };
    }>;
}

export function useX402FetchManual() {
    const { wallets } = useWallets();
    const { signTypedData: privySignTypedData } = useSignTypedData();
    const [isReady, setIsReady] = useState(false);
    const [provider, setProvider] = useState<any>(null);

    // Get embedded wallet
    // Get active wallet (prefer embedded Privy, but accept others)
    const embeddedWallet = useMemo(() => {
        const privyWallet = wallets.find(w => w.walletClientType === 'privy');
        if (privyWallet) {
            console.log('🔷 useX402FetchManual: Found Privy embedded wallet');
            return privyWallet;
        }
        // Fallback to first available wallet (e.g. Metamask)
        const otherWallet = wallets[0];
        console.log('🔷 useX402FetchManual: Using fallback wallet:', otherWallet?.walletClientType, 'address=', otherWallet?.address);
        return otherWallet;
    }, [wallets]);

    const walletAddress = embeddedWallet?.address as `0x${string}` | undefined;

    // Initialize provider
    useEffect(() => {
        if (!embeddedWallet) {
            setIsReady(false);
            setProvider(null);
            return;
        }

        embeddedWallet.getEthereumProvider().then(p => {
            console.log('🔷 useX402FetchManual: Provider ready');
            setProvider(p);
            setIsReady(true);
        }).catch(err => {
            console.error('🔷 useX402FetchManual: Failed to get provider:', err);
            setIsReady(false);
        });
    }, [embeddedWallet]);

    // Manual X402 fetch implementation
    const x402Fetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        console.log('🔷 useX402FetchManual: Making request...');

        // Inject x-wallet-address header if available (for WEBAI Credits check)
        const enrichedInit = { ...init };
        if (walletAddress) {
            // Get preference from localStorage
            const preference = localStorage.getItem('preferredPaymentMode') || 'webai';
            console.log('🔷 useX402FetchManual: Payment preference from localStorage:', preference);

            // Handle different header formats safely
            if (enrichedInit.headers instanceof Headers) {
                enrichedInit.headers.set('x-wallet-address', walletAddress);
                enrichedInit.headers.set('x-payment-preference', preference);
            } else if (Array.isArray(enrichedInit.headers)) {
                enrichedInit.headers.push(['x-wallet-address', walletAddress]);
                enrichedInit.headers.push(['x-payment-preference', preference]);
            } else {
                enrichedInit.headers = {
                    ...enrichedInit.headers,
                    'x-wallet-address': walletAddress,
                    'x-payment-preference': preference
                };
            }
        }

        console.log('🔷 useX402FetchManual: Making request with wallet:', walletAddress);

        // Make initial request
        const response = await fetch(input, enrichedInit);

        // If not 402, return as-is
        if (response.status !== 402) {
            // Check if this was a successful WEBAI payment (200 from a paid endpoint)
            // Trigger balance refresh so Navbar updates
            if (response.status === 200 && response.headers.get('x-payment-method') === 'WEBAI') {
                console.log('🔷 useX402FetchManual: WEBAI payment detected, refreshing balance...');
                window.dispatchEvent(new CustomEvent('refreshWebaiCredits'));
            }
            return response;
        }

        console.log('🔷 useX402FetchManual: Received 402, handling payment...');

        // Get payment requirements from header
        const headerValue = response.headers.get('PAYMENT-REQUIRED');
        if (!headerValue) {
            console.error('🔷 useX402FetchManual: No PAYMENT-REQUIRED header!');
            throw new Error('402 response missing PAYMENT-REQUIRED header');
        }

        // Decode base64 JSON
        let requirements: PaymentRequirements;
        try {
            const decoded = atob(headerValue);
            requirements = JSON.parse(decoded);
            console.log('🔷 useX402FetchManual: Payment requirements:', requirements);
        } catch (err) {
            console.error('🔷 useX402FetchManual: Failed to parse requirements:', err);
            throw new Error('Failed to parse payment requirements');
        }

        // Find matching network
        const accept = requirements.accepts.find(a =>
            a.network === 'eip155:84532' || a.network === 'eip155:8453' || a.network === 'base-sepolia'
        );

        if (!accept) {
            console.error('🔷 useX402FetchManual: No supported network in accepts');
            throw new Error('No supported network in payment requirements');
        }

        if (!walletAddress || !provider) {
            throw new Error('Wallet not ready');
        }

        console.log('🔷 useX402FetchManual: Creating payment signature...');
        console.log('🔷 useX402FetchManual: From:', walletAddress);
        console.log('🔷 useX402FetchManual: To:', accept.payTo);
        console.log('🔷 useX402FetchManual: Value:', accept.maxAmountRequired);
        console.log('🔷 useX402FetchManual: Asset:', accept.asset);

        // Build EIP-712 typed data for EIP-3009 TransferWithAuthorization
        const now = Math.floor(Date.now() / 1000);
        const nonce = generateNonce();

        const typedData = {
            types: {
                EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'verifyingContract', type: 'address' }
                ],
                ...EIP3009_TYPES
            },
            primaryType: 'TransferWithAuthorization',
            domain: {
                name: accept.extra.name,
                version: accept.extra.version,
                chainId: chainId,
                verifyingContract: accept.asset
            },
            message: {
                from: walletAddress,
                to: accept.payTo,
                value: accept.maxAmountRequired,
                validAfter: now.toString(),
                validBefore: (now + 300).toString(), // Valid for 5 minutes
                nonce: nonce
            }
        };

        console.log('🔷 useX402FetchManual: Typed data:', JSON.stringify(typedData, null, 2));

        // Sign with Privy embedded wallet
        let signature: string;
        try {
            console.log('🔷 useX402FetchManual: Requesting signature from Privy...');

            // Feature flag: NEXT_PUBLIC_SILENT_SIGNING=true to suppress the modal
            const useSilentSigning = process.env.NEXT_PUBLIC_SILENT_SIGNING === 'true';

            if (useSilentSigning && walletAddress && privySignTypedData) {
                // NEW: Use Privy's useSignTypedData hook with UI suppression
                console.log('🔷 useX402FetchManual: Using SILENT signing (no modal)...');
                try {
                    const result = await privySignTypedData(
                        {
                            domain: typedData.domain,
                            types: typedData.types,
                            primaryType: typedData.primaryType as string,
                            message: typedData.message,
                        },
                        {
                            address: walletAddress,
                            uiOptions: { showWalletUIs: false }
                        }
                    );
                    signature = result.signature;
                    console.log('🔷 useX402FetchManual: Silent signing succeeded!');
                } catch (silentErr) {
                    console.warn('🔷 useX402FetchManual: Silent signing failed, falling back to modal:', silentErr);
                    // Fallback to original modal-based signing
                    signature = await provider.request({
                        method: 'eth_signTypedData_v4',
                        params: [walletAddress, JSON.stringify(typedData)]
                    }) as string;
                }
            } else {
                // ORIGINAL: Use provider.request which shows the modal
                signature = await provider.request({
                    method: 'eth_signTypedData_v4',
                    params: [walletAddress, JSON.stringify(typedData)]
                }) as string;
            }

            console.log('🔷 useX402FetchManual: Got signature:', signature.substring(0, 20) + '...');
        } catch (err) {
            console.error('🔷 useX402FetchManual: Signing failed:', err);
            throw new Error('Payment signing failed');
        }

        // Build X-PAYMENT header
        // NOTE: eip712_domain should NOT be here - it belongs in paymentRequirements.extra
        // which the server already includes in the 402 challenge
        const payment = {
            x402Version: requirements.x402Version,
            scheme: accept.scheme,
            network: accept.network,
            payload: {
                signature: signature,
                authorization: {
                    from: walletAddress,
                    to: accept.payTo,
                    value: accept.maxAmountRequired,
                    validAfter: now.toString(),
                    validBefore: (now + 300).toString(),
                    nonce: nonce
                }
            }
        };

        const paymentHeader = btoa(JSON.stringify(payment));
        console.log('🔷 useX402FetchManual: Retrying with X-PAYMENT header...');

        // Retry request with payment
        const paidResponse = await fetch(input, {
            ...init,
            headers: {
                ...init?.headers,
                'X-PAYMENT': paymentHeader
            }
        });

        console.log('🔷 useX402FetchManual: Paid response status:', paidResponse.status);

        // Trigger balance refresh after successful X402 payment
        if (paidResponse.ok && typeof window !== 'undefined') {
            console.log('🔷 useX402FetchManual: Dispatching balance refresh event...');
            window.dispatchEvent(new CustomEvent('refreshWebaiCredits'));
        }

        return paidResponse;
    }, [walletAddress, provider]);

    // Return regular fetch if not ready
    const fetchToUse = isReady ? x402Fetch : window.fetch.bind(window);

    console.log('🔷 useX402FetchManual: Returning fetch, isReady=', isReady);

    return {
        fetch: fetchToUse,
        isReady,
        userWallet: walletAddress
    };
}
