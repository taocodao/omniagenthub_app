import OpenAI from 'openai';

let assistants = {}; // In-memory store for assistants

const handler = async (req, res) => {
    const { apiKey, prompt, role } = req.body;

    if (!apiKey || !prompt || !role) {
        return res.status(400).json({ message: 'API key, prompt, and role are required' });
    }

    if (assistants[role]) {
        return res.status(200).json({ message: `Assistant with role '${role}' already exists` });
    }

    try {
        // Correctly configure the OpenAI API client
        const openai = new OpenAI({
            apiKey: apiKey,
        });

        // Here you could initialize the assistant with OpenAI if needed.
        // For this example, we are just storing it in memory.
        assistants[role] = { prompt, apiKey };

        res.status(200).json({ message: `Assistant '${role}' created successfully` });
    } catch (error) {
        console.error('Error details:', error);
        res.status(500).json({ message: `Error creating assistant: ${error.message}`, error: error.message });
    }
};

export default handler;
