// testOpenAI.js
const OpenAI = require('openai');

const configuration = new OpenAI.Configuration({
    apiKey: process.env.OPENAI_API_KEY, // Replace with your actual API key for testing
});

const openai = new OpenAI.OpenAIApi(configuration);

async function testOpenAI() {
    try {
        const response = await openai.listModels();
        console.log(response.data);
    } catch (error) {
        console.error('Error:', error);
    }
}

testOpenAI();
