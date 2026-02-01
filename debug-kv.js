
import https from 'https';

const url = 'https://credible-walleye-47876.upstash.io';
const token = 'AbsEAAIncDEyZGQ0MmZhODg2YmE0OTEyYTlhNzdjNzg1YWMwN2NhN3AxNDc4NzY';

// Test SET
const setOptions = {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${token}`,
    },
};

const key = 'debug-test-key';
const value = 'debug-test-value-' + Date.now();

console.log(`Checking connection to ${url}...`);

// Simple GET request using native https to avoid dependency issues if node_fetch isn't available in shell
// Upstash REST format: URL/set/KEY/VALUE
const setReq = https.request(`${url}/set/${key}/${value}`, setOptions, (res) => {
    console.log('SET Status:', res.statusCode);

    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('SET Response:', data);

        // Test GET
        const getReq = https.request(`${url}/get/${key}`, setOptions, (res) => {
            console.log('GET Status:', res.statusCode);
            let getData = '';
            res.on('data', (chunk) => { getData += chunk; });
            res.on('end', () => {
                console.log('GET Response:', getData);
                try {
                    if (JSON.parse(getData).result === value) {
                        console.log('✅ SUCCESS: KV Read/Write is working!');
                    } else {
                        console.log('❌ FAILURE: Read value did not match written value.');
                    }
                } catch (e) {
                    console.log('❌ FAILURE: Could not parse response.');
                }
            });
        });
        getReq.on('error', (e) => console.error('GET Error:', e));
        getReq.end();
    });
});

setReq.on('error', (e) => {
    console.error('SET Connection Error:', e);
});

setReq.end();
