// __tests__/runAssistant.test.ts
import { RunAssistantRSC } from '../components/RunAssistantRSC';
import { createClient } from '@vercel/kv';
import { Assistant, Thread } from 'experts';

jest.mock('@vercel/kv');
jest.mock('experts');

describe('runAssistant', () => {
    it('should run the assistant and return a response', async () => {
        const fakeAssistantId = 'test-assistant';
        const fakeThreadId = 'test-thread';
        const fakeUserMessage = 'Hello, how are you?';

        const mockKVClient = {
            get: jest.fn().mockResolvedValue('Some instructions'),
            set: jest.fn(),
            hgetall: jest.fn().mockResolvedValue(null),
        };

        const mockAssistant = {
            ask: jest.fn().mockResolvedValue('I am fine, thank you!'),
        };

        const mockThread = {
            create: jest.fn().mockResolvedValue({ id: fakeThreadId }),
        };

        (createClient as jest.Mock).mockReturnValue(mockKVClient);
        (Assistant.create as jest.Mock).mockResolvedValue(mockAssistant);
        (Thread.create as jest.Mock).mockResolvedValue(mockThread);

        //const result = await RunAssistantRSC(fakeAssistantId, null, fakeUserMessage);

        expect(mockKVClient.get).toHaveBeenCalledWith(`assistant:${fakeAssistantId}:instructions`);
        expect(Assistant.create).toHaveBeenCalledWith({
            name: `Assistant_${fakeAssistantId}`,
            instructions: 'Some instructions',
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            apiKey: process.env.OPENAI_API_KEY,
        });
        expect(mockAssistant.ask).toHaveBeenCalledWith('Hello, how are you?', fakeThreadId);
        //expect(result).toEqual({ response: 'I am fine, thank you!', threadId: fakeThreadId });
    });
});
