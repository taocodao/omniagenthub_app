import { ethers } from 'ethers';
import crypto from 'crypto';

/**
 * Generate a deterministic Ethereum wallet address from Auth0 user ID
 * This ensures each user gets a consistent wallet address based on their Auth0 sub claim
 * 
 * @param auth0UserId - The user's Auth0 sub claim (e.g., "auth0|123456" or "google-oauth2|117686...")
 * @returns Object containing wallet address and private key
 */
export function generateWalletFromAuth0Id(auth0UserId: string): {
    address: string;
    privateKey: string;
} {
    if (!auth0UserId) {
        throw new Error('Auth0 user ID is required to generate wallet');
    }

    // Get seed secret from environment
    const seedSecret = process.env.WALLET_SEED_SECRET;
    if (!seedSecret) {
        throw new Error('WALLET_SEED_SECRET environment variable is not set');
    }

    // Create a deterministic seed from Auth0 user ID + server secret
    const seed = crypto
        .createHash('sha256')
        .update(auth0UserId + seedSecret)
        .digest('hex'); // Output as hex string for ethers v5

    // Generate wallet from seed (ethers v5 accepts hex string directly)
    const wallet = new ethers.Wallet(seed);

    return {
        address: wallet.address, // Ethereum address like "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
        privateKey: wallet.privateKey, // Private key (store securely if needed)
    };
}

/**
 * Get thirdweb SDK v4 wallet instance
 * Compatible with @thirdweb-dev/sdk v4
 */
export function getThirdwebSDKWallet(auth0UserId: string): ethers.Wallet {
    const { privateKey } = generateWalletFromAuth0Id(auth0UserId);
    return new ethers.Wallet(privateKey);
}

/**
 * Get thirdweb account from Auth0 ID
 * Returns wallet with helper methods
 */
export function getThirdwebAccountFromAuth0Id(auth0UserId: string) {
    const { address, privateKey } = generateWalletFromAuth0Id(auth0UserId);
    const wallet = new ethers.Wallet(privateKey);

    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        getWallet: () => wallet,
        getSigner: (provider: ethers.providers.Provider) => wallet.connect(provider),
    };
}

/**
 * Get ethers Wallet instance for signing transactions
 * Use this for custom transaction signing
 * 
 * @param auth0UserId - The user's Auth0 sub claim
 * @returns Ethers Wallet instance
 */
export function getEthersWalletForUser(auth0UserId: string): ethers.Wallet {
    const { privateKey } = generateWalletFromAuth0Id(auth0UserId);
    return new ethers.Wallet(privateKey);
}

/**
 * Get wallet with provider (for sending transactions)
 * Ethers v5 syntax
 * 
 * @param auth0UserId - The user's Auth0 sub claim
 * @param providerUrl - RPC endpoint URL (e.g., Alchemy, Infura)
 * @returns Wallet connected to provider
 */
export function getWalletWithProvider(
    auth0UserId: string,
    providerUrl: string
): ethers.Wallet {
    const wallet = getEthersWalletForUser(auth0UserId);
    // Ethers v5: providers.JsonRpcProvider
    const provider = new ethers.providers.JsonRpcProvider(providerUrl);
    return wallet.connect(provider);
}

/**
 * Validate if a string is a valid Ethereum address
 * Ethers v5 syntax
 */
export function isValidEthereumAddress(address: string): boolean {
    try {
        // Ethers v5: utils.getAddress() throws if invalid
        ethers.utils.getAddress(address);
        return true;
    } catch {
        return false;
    }
}

/**
 * Alternative validation using isAddress
 * Ethers v5 syntax
 */
export function isValidPolygonAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
}

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Get just the address without needing to store private key
 * Useful for display purposes only
 */
export function getAddressFromAuth0Id(auth0UserId: string): string {
    const { address } = generateWalletFromAuth0Id(auth0UserId);
    return address;
}

/**
 * Parse ether amount (ethers v5 syntax)
 */
export function parseEther(amount: string): ethers.BigNumber {
    return ethers.utils.parseEther(amount);
}

/**
 * Format ether amount (ethers v5 syntax)
 */
export function formatEther(amount: ethers.BigNumberish): string {
    return ethers.utils.formatEther(amount);
}
