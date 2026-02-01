import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import { ThirdwebSDK, SmartContract } from '@thirdweb-dev/sdk';
import { ACTIVE_CHAIN, TRANSACTION_FEE_RATE, PLATFORM_NAME, ACCOUNT_FACTORY_ADDRESS } from '../../constants/constants';

import { PolygonAmoyTestnet, Polygon, Chain } from '@thirdweb-dev/chains';

const chainMap: { [key: string]: Chain } = {
    "polygon-amoy-testnet": PolygonAmoyTestnet,
    "polygon": Polygon,
};

// Ensure activeChain is a Chain object
const activeChain: Chain = chainMap[ACTIVE_CHAIN];

// Initialize Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL || "https://credible-walleye-47876.upstash.io",
    token: process.env.KV_REST_API_TOKEN || "AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY",
});

type Data = {
    message: string;
    remainingCredits?: number;
    success?: boolean;
};

// Function to send funds using the Thirdweb SDK
const sendFunds = async (
    receiverUsername: string | undefined,
    sendAmount: number,
    accountFactory: SmartContract<any>,
    sdk: ThirdwebSDK
): Promise<boolean> => {
    try {
        const receiverWalletAddress = await accountFactory.call("accountOfUsername", [receiverUsername]);

        if (receiverWalletAddress === "0x0000000000000000000000000000000000000000") {
            console.log("Username does not exist");
            return false;
        }

        await sdk.wallet.transfer(receiverWalletAddress, sendAmount);
        console.log("Funds sent");
        return true;
    } catch (error) {
        console.log("Error sending funds", error);
        return false;
    }
};

// Function to handle crypto payments
export async function payByCrypto(user: string, sendAmount: number, res: NextApiResponse<Data>): Promise<boolean> {
    try {
        // Initialize the SDK
        const sdk = new ThirdwebSDK(activeChain);

        // Get the account factory contract
        const accountFactory = await sdk.getContract(ACCOUNT_FACTORY_ADDRESS);

        if (!accountFactory) {
            res.status(500).json({ message: "Account factory contract not found.", success: false });
            return false;
        }

        // Send a message indicating that the payment process has started
        res.status(200).json({ message: "Payment process started...", success: true });

        // Perform the payment
        const transactionFee = Number(sendAmount) * Number(TRANSACTION_FEE_RATE);
        const sendFundsSuccess = await sendFunds(user, Number(sendAmount), accountFactory, sdk) &&
            await sendFunds(PLATFORM_NAME, transactionFee, accountFactory, sdk);

        if (sendFundsSuccess) {
            console.log("Payment successful");
            // Send a message indicating that the payment has finished successfully
            res.status(200).json({ message: "Payment completed successfully!", success: true });
            return true;
        } else {
            console.log("Payment failed");
            // Send a message indicating that the payment has failed
            res.status(500).json({ message: "Payment failed.", success: false });
            return false;
        }
    } catch (error) {
        console.error("Error during payment:", error);
        res.status(500).json({ message: "Internal server error during payment.", success: false });
        return false;
    }
}

// API handler function
export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
    const { userKey, price, user } = req.body;

    if (!userKey || price === undefined || !user) {
        return res.status(400).json({ message: "Missing required parameters." });
    }

    try {
        // Fetch current WEBAI Credits from KV store
        let currentCredits = await kv.get(`${userKey}:webaiCredits`) as number;
        currentCredits = currentCredits ? Number(currentCredits) : 0;

        if (currentCredits === 0) {
            // No WEBAI Credits available, proceed with crypto payment
            await payByCrypto(user, price, res);
            return;
        }

        // Calculate credits to use
        const creditsToUse = -Math.floor(price / 0.01);
        const newCredits = currentCredits + creditsToUse;

        if (newCredits >= 0) {
            // Sufficient WEBAI Credits, update balance
            await kv.set(`${userKey}:webaiCredits`, newCredits);
            res.status(200).json({ remainingCredits: newCredits, message: "WEBAI Credits successfully used.", success: true });
            return;
        } else {
            // Insufficient WEBAI Credits, update balance and proceed with partial crypto payment
            await kv.set(`${userKey}:webaiCredits`, 0);
            const remainingPrice = -newCredits * price;  // Updated calculation for remaining price
            await payByCrypto(user, remainingPrice, res);
            return;
        }
    } catch (error) {
        console.error('Error in process_payment:', error);
        res.status(500).json({ message: 'Internal server error.', success: false });
    }
}

