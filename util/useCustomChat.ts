// utils/useCustomChat.ts

import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

// Define the Message interface with a unique 'id'
interface Message {
    id: string; // Unique identifier
    role: 'user' | 'assistant';
    content: string;
}

// Unique ID generator using Date.now() and Math.random()
const generateUniqueId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useCustomChat = (apiEndpoint: string) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState<string>('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = { id: generateUniqueId(), role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: [...messages, userMessage] }),
            });

            if (!response.ok) {
                // Attempt to parse error response
                let errorMessage = 'An error occurred. Please try again.';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch {
                    // If parsing fails, keep the default error message
                }
                console.error('Referral API response not OK:', errorMessage);
                toast.error(errorMessage);
                return;
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let assistantMessageContent = '';

            while (!done && reader) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                const chunk = decoder.decode(value);
                assistantMessageContent += chunk;

                // Parse the chunk for EventStream data
                const lines = chunk.split('\n').filter(line => line.startsWith('data:'));
                for (const line of lines) {
                    const data = line.replace('data: ', '').trim();
                    if (data === '[DONE]') {
                        if (assistantMessageContent.startsWith('Error:')) {
                            const errorContent = assistantMessageContent.replace('Error:', '').trim();
                            toast.error(errorContent || 'An unknown error occurred.');
                        } else {
                            const assistantMessage: Message = { id: generateUniqueId(), role: 'assistant', content: assistantMessageContent };
                            setMessages(prev => [...prev, assistantMessage]);
                        }
                        assistantMessageContent = '';
                    } else {
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content.startsWith('Error:')) {
                                const errorContent = parsed.content.replace('Error:', '').trim();
                                toast.error(errorContent || 'An unknown error occurred.');
                            } else {
                                const assistantMessage: Message = { id: generateUniqueId(), role: 'assistant', content: parsed.content };
                                setMessages(prev => [...prev, assistantMessage]);
                            }
                        } catch (err) {
                            console.error('Failed to parse chunk:', err);
                        }
                    }
                }
            }
        } catch (error: any) {
            console.error('Chat error:', error);
            toast.error(error.message || 'An error occurred during the chat.');
        }
    };

    // Function to reset messages
    const resetMessages = () => {
        setMessages([]);
    };

    return { messages, input, handleInputChange, handleSubmit, resetMessages };
};
