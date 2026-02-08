// scripts/setup-composio-linkedin.js
// Script to create LinkedIn Auth Config via Composio API using axios

const axios = require('axios');
const fs = require('fs');

const COMPOSIO_API_KEY = 'ak_K707mgr8g_dynkxFwl8D';
const LOG_FILE = 'composio-setup-log.txt';

function log(message) {
    const line = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

async function createLinkedInAuthConfig() {
    fs.writeFileSync(LOG_FILE, ''); // Clear log
    log('🔧 Creating LinkedIn Auth Config via Composio API...\n');

    const headers = {
        'x-api-key': COMPOSIO_API_KEY,
        'Content-Type': 'application/json',
    };

    try {
        // First, let's test API connectivity
        log('1. Testing API connectivity...');
        try {
            const testResponse = await axios.get('https://backend.composio.dev/api/v2/apps', { headers });
            log(`   ✅ API connection successful (Status: ${testResponse.status})\n`);
        } catch (testErr) {
            log(`   ❌ API test failed: ${testErr.message}`);
            if (testErr.response) {
                log(`   Status: ${testErr.response.status}`);
                log(`   Data: ${JSON.stringify(testErr.response.data)}`);
            }
            return;
        }

        // Check if LinkedIn auth configs already exist
        log('2. Checking for existing LinkedIn auth configs...');
        try {
            const authConfigsResponse = await axios.get(
                'https://backend.composio.dev/api/v1/auth_configs?appName=linkedin',
                { headers }
            );
            log(`   Status: ${authConfigsResponse.status}`);
            log(`   Response: ${JSON.stringify(authConfigsResponse.data)}`);

            const items = authConfigsResponse.data.items || authConfigsResponse.data;
            if (Array.isArray(items) && items.length > 0) {
                const existingConfig = items[0];
                const configId = existingConfig.id || existingConfig.authConfigId;
                log(`\n   ✅ Found existing LinkedIn Auth Config!`);
                log(`   Auth Config ID: ${configId}`);
                log(`\n\n=== ADD TO .ENV ===`);
                log(`COMPOSIO_LINKEDIN_AUTH_CONFIG_ID=${configId}`);
                return configId;
            }
        } catch (listErr) {
            log(`   List auth configs error: ${listErr.message}`);
            if (listErr.response) {
                log(`   Status: ${listErr.response.status}`);
                log(`   Data: ${JSON.stringify(listErr.response.data)}`);
            }
        }
        log('   No existing config found\n');

        // Create new auth config
        log('3. Creating new LinkedIn Auth Config...');
        try {
            const createResponse = await axios.post(
                'https://backend.composio.dev/api/v1/auth_configs',
                {
                    appName: 'linkedin',
                    useComposioAuth: true,
                },
                { headers }
            );

            log(`   Response status: ${createResponse.status}`);
            log(`   Response body: ${JSON.stringify(createResponse.data)}`);

            const config = createResponse.data;
            const configId = config.id || config.authConfigId || config.auth_config_id;
            log(`\n   ✅ Auth Config created successfully!`);
            log(`\n\n=== ADD TO .ENV ===`);
            log(`COMPOSIO_LINKEDIN_AUTH_CONFIG_ID=${configId}`);
            return configId;
        } catch (createErr) {
            log(`   Create auth config error: ${createErr.message}`);
            if (createErr.response) {
                log(`   Status: ${createErr.response.status}`);
                log(`   Data: ${JSON.stringify(createErr.response.data)}`);
            }
        }

    } catch (error) {
        log(`Error: ${error.message}`);
        log(error.stack);
    }
}

createLinkedInAuthConfig();
