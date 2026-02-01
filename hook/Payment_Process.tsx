// hooks/Payment_Process.tsx
/**
 * Payment Processing Hook - WEBAI Credits (KV-based)
 * 
 * This hook handles payments using off-chain WEBAI credits stored in Vercel KV.
 * All legacy on-chain crypto and "free tier" logic has been removed.
 * 
 * For USDC on-chain payments, use the `x402Fetch` hook instead.
 */
import { useState } from 'react';

/**
 * Get Privy embedded wallet address by user's email.
 */
const getAccountAddressByEmail = async (email: string): Promise<string | null> => {
    try {
        const response = await fetch('/api/user/getWalletByEmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await response.json();
        return data.success ? data.address : null;
    } catch (error) {
        console.error('Error fetching address by email:', error);
        return null;
    }
};

export function usePayment() {
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

    /**
     * Process a WEBAI credit payment.
     * 
     * @param userAddress The user's wallet address (used as KV key)
     * @param price The price in USD (e.g., 0.01 = 1 cent)
     * @param recipientAddress Optional: Wallet address of the recipient (for transfers between users)
     * @returns Promise<boolean> - true if payment succeeded, false otherwise
     */
    const process_payment = async (
        userAddress: string,
        price: number,
        recipientAddress?: string
    ): Promise<boolean> => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💳 process_payment CALLED (WEBAI Credits Only)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📍 Input Parameters:');
        console.log('   userAddress:', userAddress);
        console.log('   price:', price);
        console.log('   recipientAddress:', recipientAddress || 'N/A (platform payment)');

        if (!userAddress || typeof price !== 'number' || price <= 0) {
            console.error('❌ Invalid parameters: userAddress or price missing/invalid');
            return false;
        }

        setIsPaymentProcessing(true);

        try {
            // Call the WEBAI credits API
            const requestBody = {
                userKey: userAddress,
                price,
                // If we have a recipient, include it for credit transfer
                ...(recipientAddress && { recipientAddress })
            };

            console.log('📡 Calling /api/useWebaiCredits with:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('/api/useWebaiCredits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📥 API Response:');
            console.log(JSON.stringify(data, null, 2));
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            if (data.success) {
                console.log('✅ WEBAI Credits payment successful!');
                console.log('   New balance:', data.balance);

                // Dispatch event so UI components can refresh balance
                window.dispatchEvent(new CustomEvent('refreshWebaiCredits'));

                setIsPaymentProcessing(false);
                return true;
            } else {
                console.error('❌ Payment failed:', data.message || data.error || 'Unknown error');
                console.error('   Current balance:', data.balance);
                setIsPaymentProcessing(false);
                return false;
            }

        } catch (error: any) {
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.error('❌ ERROR in process_payment:');
            console.error('   Message:', error.message || error);
            console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            setIsPaymentProcessing(false);
            return false;
        }
    };

    /**
     * Fetch price for a specific role from KV storage.
     * Call this before process_payment to get the correct price.
     * 
     * @param department The department name
     * @param role The role name
     * @returns Promise<number> - The price in USD, defaults to 0.01 if not set
     */
    const fetchRolePrice = async (department: string, role: string): Promise<number> => {
        try {
            const response = await fetch('/api/get-role-mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department, role }),
            });
            const data = await response.json();
            return data.price || 0.01; // Default to $0.01 if not set
        } catch (error) {
            console.error('Error fetching role price:', error);
            return 0.01; // Default fallback
        }
    };

    return {
        process_payment,
        isPaymentProcessing,
        fetchRolePrice,
        getAccountAddressByEmail
    };
}
