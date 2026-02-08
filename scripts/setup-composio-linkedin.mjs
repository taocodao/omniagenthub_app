// scripts/setup-composio-linkedin.mjs
// Script to create LinkedIn Auth Config via Composio v3 API
import * as fs from 'fs';
import * as https from 'https';

const COMPOSIO_API_KEY = 'ak_K707mgr8g_dynkxFwl8D';
const OUTPUT_FILE = 'composio-result.json';

function httpsRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: data });
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    const results = { steps: [], authConfigId: null, error: null };

    try {
        // Check existing auth configs with v3 API for LinkedIn
        results.steps.push('Step 1: Checking existing LinkedIn configs...');
        const listResult = await httpsRequest({
            hostname: 'backend.composio.dev',
            path: '/api/v3/auth_configs?toolkit=linkedin',
            method: 'GET',
            headers: { 'x-api-key': COMPOSIO_API_KEY },
        });
        results.steps.push(`List Status: ${listResult.status}`);
        results.existingConfigs = listResult.body;

        let foundExisting = false;
        try {
            const listData = JSON.parse(listResult.body);
            const items = listData.items || listData.data || listData || [];

            if (Array.isArray(items) && items.length > 0) {
                results.authConfigId = items[0].id || items[0].authConfigId;
                results.steps.push(`Found existing: ${results.authConfigId}`);
                foundExisting = true;
            }
        } catch (e) {
            results.steps.push(`Parse error: ${e.message}`);
        }

        if (!foundExisting) {
            // Try v3 API with correct object structure
            results.steps.push('Step 2: Creating new LinkedIn auth config (v3 object format)...');
            const createBody = JSON.stringify({
                toolkit: {
                    slug: 'linkedin'
                },
                name: 'OmniAgentHub LinkedIn',
                useComposioAuth: true,
            });
            let createResult = await httpsRequest({
                hostname: 'backend.composio.dev',
                path: '/api/v3/auth_configs',
                method: 'POST',
                headers: {
                    'x-api-key': COMPOSIO_API_KEY,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(createBody),
                },
            }, createBody);
            results.steps.push(`Create Status (object): ${createResult.status}`);
            results.createResponse1 = createResult.body;

            // If that fails, try alternate format
            if (createResult.status !== 200 && createResult.status !== 201) {
                results.steps.push('Step 3: Trying alternate format...');
                const createBody2 = JSON.stringify({
                    toolkit: {
                        name: 'linkedin'
                    },
                    authScheme: 'COMPOSIO_MANAGED',
                });
                createResult = await httpsRequest({
                    hostname: 'backend.composio.dev',
                    path: '/api/v3/auth_configs',
                    method: 'POST',
                    headers: {
                        'x-api-key': COMPOSIO_API_KEY,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(createBody2),
                    },
                }, createBody2);
                results.steps.push(`Create Status (alt): ${createResult.status}`);
                results.createResponse2 = createResult.body;
            }

            // Try v2 API as fallback
            if (createResult.status !== 200 && createResult.status !== 201) {
                results.steps.push('Step 4: Trying v2 API...');
                const createBody3 = JSON.stringify({
                    appName: 'linkedin',
                    authScheme: 'OAUTH2',
                });
                createResult = await httpsRequest({
                    hostname: 'backend.composio.dev',
                    path: '/api/v2/auth-configs',
                    method: 'POST',
                    headers: {
                        'x-api-key': COMPOSIO_API_KEY,
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(createBody3),
                    },
                }, createBody3);
                results.steps.push(`Create Status (v2): ${createResult.status}`);
                results.createResponse3 = createResult.body;
            }

            if (createResult.status === 200 || createResult.status === 201) {
                try {
                    const createData = JSON.parse(createResult.body);
                    results.authConfigId = createData.id || createData.authConfigId || createData.data?.id;
                } catch (e) {
                    results.steps.push(`Create parse error: ${e.message}`);
                }
            }
        }

    } catch (error) {
        results.error = error.message;
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
}

main();
