// util/hashToFixedDigits.ts

import crypto from 'crypto';

class HashUtil {
    /**
     * Check if the input looks like an Ethereum address.
     * An Ethereum address starts with "0x" or "0X" followed by 40 hexadecimal characters.
     * 
     * @param {string} input - The input string to check.
     * @returns {boolean} - True if it looks like an Ethereum address.
     */
    private static isEthereumAddress(input: string): boolean {
        // Regex: starts with 0x (case insensitive), followed by exactly 40 hex characters
        return /^0x[a-fA-F0-9]{40}$/i.test(input.trim());
    }

    /**
     * Hash a long string into a fixed-length numeric representation.
     * For Ethereum addresses (0x...), normalizes to lowercase before hashing.
     * For all other strings, uses the original input (after trimming).
     * 
     * @param {string} input - The input string to hash.
     * @returns {string} - The hashed numeric representation (10 digits).
     */
    static hashTo(input: string): string {
        const length = 10;

        // Trim whitespace
        const trimmedInput = input.trim();

        // ✅ ONLY normalize Ethereum addresses to lowercase
        // Everything else keeps its original casing
        const normalizedInput = this.isEthereumAddress(trimmedInput)
            ? trimmedInput.toLowerCase()
            : trimmedInput;

        // Generate SHA-256 hash
        const hash = crypto.createHash('sha256').update(normalizedInput).digest('hex');

        // Convert hex hash to a big integer, then to string
        const numericHash = BigInt('0x' + hash).toString();

        // Trim to desired length or pad with zeros if needed
        return numericHash.slice(0, length).padEnd(length, '0');
    }
}

export default HashUtil;
