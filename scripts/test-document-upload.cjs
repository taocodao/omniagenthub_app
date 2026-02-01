// scripts/test-document-upload.cjs
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const SURFSENSE_API_URL = 'https://surfsense-backend-730233624615.us-central1.run.app';
const SURFSENSE_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDQxOTIwZS0wZTgyLTQ5ODEtYmY4OC0yZGYxNTg3NWQ1ZTgiLCJhdWQiOlsiZmFzdGFwaS11c2VyczphdXRoIl0sImV4cCI6MTc2MDEyMzAyMX0.wjhnGjG6vKJLfVLPj3c5sHSq2VkvuoUZAs77_rq58z8';
const SEARCH_SPACE_ID = 13;

async function testUploadAndPoll() {
  console.log('🧪 Testing SurfSense Upload & Polling\n');

  const timestamp = Date.now();
  const testFileName = `test-${timestamp}.txt`;
  const testFilePath = path.join(process.cwd(), testFileName);

  try {
    // Create tiny test file
    console.log('📝 Creating test file...');
    fs.writeFileSync(testFilePath, `Test Document ${timestamp}\nHello World!`);
    console.log(`✅ Created: ${testFileName}\n`);

    // Upload file
    console.log('📤 Uploading to SurfSense...');
    const formData = new FormData();
    formData.append('files', fs.createReadStream(testFilePath), {
      filename: testFileName,
      contentType: 'text/plain'
    });
    formData.append('search_space_id', SEARCH_SPACE_ID.toString());

    const uploadResponse = await axios.post(
      `${SURFSENSE_API_URL}/api/v1/documents/fileupload`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`,
          ...formData.getHeaders()
        }
      }
    );

    console.log('✅ Upload response:', uploadResponse.data);
    console.log('');

    // Poll for document
    console.log('🔄 Polling for document (60 seconds max)...\n');
    const maxAttempts = 20;
    const baseFileName = path.parse(testFileName).name.toLowerCase();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`   Attempt ${attempt}/${maxAttempts}...`);

      const response = await axios.get(
        `${SURFSENSE_API_URL}/api/v1/documents/?search_space_id=${SEARCH_SPACE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${SURFSENSE_JWT_TOKEN}`
          }
        }
      );

      const documents = response.data.items || response.data || [];
      console.log(`   Total documents in space: ${documents.length}`);

      // Find matching document
      const matchingDoc = documents.find((doc) => {
        const docTitle = (doc.title || doc.filename || doc.name || '').toLowerCase();
        const docName = path.parse(docTitle).name;
        return docName.includes(baseFileName) || baseFileName.includes(docName);
      });

      if (matchingDoc) {
        console.log('\n✅ SUCCESS! Document found:');
        console.log(JSON.stringify(matchingDoc, null, 2));
        console.log(`\n⏱️  Indexing took ~${attempt * 3} seconds`);
        break;
      }

      if (attempt === maxAttempts) {
        console.log('\n❌ Document NOT found after 60 seconds');
        console.log('All documents in search space:');
        console.log(JSON.stringify(documents, null, 2));
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  } finally {
    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log(`\n🧹 Cleaned up ${testFileName}`);
    }
  }
}

testUploadAndPoll();
