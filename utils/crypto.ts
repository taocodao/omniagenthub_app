// utils/crypto.ts

import crypto from 'crypto';

const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc' as const; // Type assertion

export function encrypt(text: string): string {
    if (!process.env.ENCRYPTION_SECRET) {
        throw new Error('Missing encryption secret');
    }

    // Convert key to Uint8Array
    const key = new Uint8Array(
        crypto.scryptSync(process.env.ENCRYPTION_SECRET, 'salt', 32)
    );

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${iv.toString('hex')}:${encrypted}`;
}

export function decrypt(text: string): string {
    if (!process.env.ENCRYPTION_SECRET) {
        throw new Error('Missing encryption secret');
    }

    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    // Convert key to Uint8Array
    const key = new Uint8Array(
        crypto.scryptSync(process.env.ENCRYPTION_SECRET, 'salt', 32)
    );

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
