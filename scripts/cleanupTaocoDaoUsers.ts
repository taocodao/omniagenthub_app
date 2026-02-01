// scripts/cleanupTaocoDaoUsers.ts
// Run with: npx ts-node scripts/cleanupTaocoDaoUsers.ts

import { createClient } from '@vercel/kv';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

async function cleanupTaocoDaoUsers() {
    const companyName = 'TaocoDAO';

    // Users to keep:
    // 1. erichuang2004@gmail.com - 0xc58aCc046d60FE877aC6fA3070665743Da52A89C
    // 2. Eric - 0xDC5E...38D0 (need to find full address)

    console.log(`\n🔧 Cleaning up company users for: ${companyName}`);
    console.log(`📧 Will keep: erichuang2004@gmail.com and Eric`);

    try {
        // Get current company users
        const companyUsersKey = `companyUsers:${companyName}`;
        const storedUserAddresses = await kv.get<string[]>(companyUsersKey);

        console.log(`\n📋 Current users in ${companyName}:`);

        if (!storedUserAddresses || !Array.isArray(storedUserAddresses)) {
            console.log('❌ No users found or invalid data');
            return;
        }

        // Find the users we want to keep
        const keepAddresses: string[] = [];
        const mainUserAddress = '0xc58aCc046d60FE877aC6fA3070665743Da52A89C'; // erichuang2004@gmail.com

        for (const addr of storedUserAddresses) {
            const userName = await kv.get<string>(`userName:${addr}`);
            console.log(`  - ${addr}: ${userName}`);

            // Keep erichuang2004@gmail.com (main user)
            if (addr.toLowerCase() === mainUserAddress.toLowerCase()) {
                keepAddresses.push(addr);
                console.log(`    ✅ Will keep (erichuang2004@gmail.com)`);
            }
            // Keep "Eric" user (partial address 0xDC5E...38D0)
            else if (userName === 'Eric' || (addr.startsWith('0xDC5E') || addr.toLowerCase().includes('dc5e'))) {
                keepAddresses.push(addr);
                console.log(`    ✅ Will keep (Eric)`);
            }
        }

        if (keepAddresses.length === 0) {
            console.log('\n❌ Could not find users to keep!');
            return;
        }

        console.log(`\n📌 Users to keep: ${keepAddresses.length}`);
        keepAddresses.forEach(addr => console.log(`   - ${addr}`));

        // Update company users list
        console.log(`\n🗑️  Updating ${companyUsersKey}...`);
        await kv.set(companyUsersKey, keepAddresses);

        // Verify the update
        const updatedUsers = await kv.get<string[]>(companyUsersKey);
        console.log(`\n✅ Updated company users:`);
        if (updatedUsers) {
            for (const addr of updatedUsers) {
                const userName = await kv.get<string>(`userName:${addr}`);
                console.log(`   - ${addr}: ${userName}`);
            }
        }

        console.log('\n🎉 Cleanup complete!');

    } catch (error) {
        console.error('Error:', error);
    }
}

cleanupTaocoDaoUsers().then(() => process.exit(0));
