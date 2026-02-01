import { NextApiRequest, NextApiResponse } from 'next';
import { ThirdwebSDK, SmartContract } from "@thirdweb-dev/sdk";
import { ACCOUNT_FACTORY_ADDRESS, PLATFORM_NAME, TRANSACTION_FEE_RATE, ACTIVE_CHAIN } from '../../constants/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Create the SDK instance using ACTIVE_CHAIN from the constants
    const sdk = new ThirdwebSDK(ACTIVE_CHAIN);
    const accountFactory: SmartContract = await sdk.getContract(ACCOUNT_FACTORY_ADDRESS);

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { user, sendAmount } = req.body;

    try {
        const sendFunds = async (
            receiverUsername: string | undefined,
            sendAmount: number,
            accountFactory: SmartContract<any>,
            sdk: ThirdwebSDK
        ) => {
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

        const transactionFee = Number(sendAmount) * Number(TRANSACTION_FEE_RATE); // 20% transaction fee
        const sendFundsSuccess =
            (await sendFunds(user, Number(sendAmount), accountFactory, sdk)) &&
            (await sendFunds(PLATFORM_NAME, transactionFee, accountFactory, sdk));

        if (sendFundsSuccess) {
            console.log("Payment successful");
        } else {
            console.log("Payment failed");
        }

        res.status(200).json({ success: true, message: 'Payment sent successfully' });
    } catch (error) {
        console.error('Error sending payment:', error);
        res.status(500).json({ success: false, message: 'Failed to send payment' });
    }
}
