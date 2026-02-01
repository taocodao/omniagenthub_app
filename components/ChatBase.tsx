/* eslint-disable react-hooks/exhaustive-deps */
// components/ChatBase.tsx

import React, { useState, useEffect, useContext, useMemo } from 'react';
import QAResponse from './QAResponse';
import { UserQuestions, UserQA, QuestionAnswer } from '../types';
import HashUtil from '../util/hashToFixedDigits';
import { useActiveAccount } from '../hooks/useWalletAddress';
import { ChatBaseStream } from './ChatBaseStream';
import styles from "../styles/Home6.module.css";
import { LocalizedText } from '../util/LocalizedText';
import { LocalizationContext } from '../util/LocalizationContext';
import { polygonAmoy, polygon, Chain } from "thirdweb/chains";
import { ACTIVE_CHAIN } from "../constants/constants";
import { usePayment } from '../hook/Payment_Process';
import { debounce, throttle } from 'lodash';
import { useCallback } from 'react';
import { getLocalizedString } from '../util/LocalizedText';
import { toast } from 'react-toastify';

export const maxDuration = 300; // This function can run for a maximum of 300 seconds

export const dynamic = 'force-dynamic';


interface ChatBaseProps {
    role: string;
    task: string;
    department: string;
    requiresSDK?: boolean;
    price?: number;
    user?: string; // Add as OPTIONAL
    kbSelectedSources?: string[]; // Knowledge Base source IDs
}

const ChatBase: React.FC<ChatBaseProps> = ({ role, task, department, kbSelectedSources = [] }) => {
    const [qaResponse, setQAResponse] = useState('');
    const [editableQA, setEditableQA] = useState<QuestionAnswer[]>([]);
    const [editableQAForEmbed, setEditableQAForEmbed] = useState<QuestionAnswer[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [isJsonFormat, setIsJsonFormat] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [numQuestions, setNumQuestions] = useState(0);
    const [showChatStream, setShowChatStream] = useState(false);
    const { account, isLoading: isAccountLoading, error } = useActiveAccount();
    const userAddress = account?.address;
    const [textareaHeights, setTextareaHeights] = useState<number[]>([]);
    // const assistantId = HashUtil.hashTo(role + task);
    // const generatedThreadId = HashUtil.hashTo(role + task + userAddress);
    const assistantId = useMemo(() => HashUtil.hashTo(role + task), [role, task]);
    const generatedThreadId = useMemo(() => HashUtil.hashTo(role + task + userAddress), [role, task, userAddress]);

    // const { contract: accountFactory } = useContract(ACCOUNT_FACTORY_ADDRESS);
    const chainMap: { [key: string]: Chain } = {
        "polygon-amoy-testnet": polygonAmoy,
        "polygon": polygon, // Add Polygon mainnet
    };

    // Ensure activeChain is a Chain object
    const activeChain: Chain = chainMap[ACTIVE_CHAIN];
    const [user, setUser] = useState<string | null>(null);
    const [price, setPrice] = useState<number | null>(null);
    const { language, setLanguage } = useContext(LocalizationContext);
    const [originalQuestions, setOriginalQuestions] = useState<string[]>([]);
    const { process_payment, isPaymentProcessing } = usePayment();
    const [isAssistantRun, setIsAssistantRun] = useState(false); // Track if assistant has run
    const memoizedLanguage = useMemo(() => language, [language]);
    const [saveToTaskChecks, setSaveToTaskChecks] = useState<boolean[]>([]);


    useEffect(() => {
        if (!userAddress || isAssistantRun) return;

        //console.log("assistant Id is", assistantId);
        //console.log("Thread Id is", generatedThreadId);

        const runInitialTasks = async () => {
            await handleCleanThread();
            await handleRunAssistant();
            setIsAssistantRun(true);
        };

        runInitialTasks();
    }, [userAddress, task]);  // Remove `assistantId` and `generatedThreadId`, they are derived from `task` and `userAddress`

    useEffect(() => {
        // Pre-check checkboxes for saved questions
        if (editableQA.length > 0 && saveToTaskChecks.length !== editableQA.length) {
            const updatedSaveToTaskChecks = editableQA.map((qa) => qa.saveToTaskChecked || false);
            setSaveToTaskChecks(updatedSaveToTaskChecks);
        }
    }, [editableQA]);




    useEffect(() => {
        fetchRoleMappings();
    }, [department, role]);

    const getRoleMappings = async (department: string, role: string) => {
        const response = await fetch('/api/get-role-mappings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ department, role }),
        });

        if (!response.ok) {
            throw new Error('Failed to get role mappings');
        }

        const data = await response.json();

        return data;
    };

    const fetchRoleMappings = async () => {
        try {
            const roleMappings = await getRoleMappings(department, role);
            //console.log("roleMappings is ", roleMappings);

            setUser(roleMappings.user);
            setPrice(roleMappings.price);

            //console.log("Updated user is ", roleMappings.user);
            //console.log("Updated price is ", roleMappings.price);

            return roleMappings; // Return the fetched data
        } catch (error) {
            console.error('Error fetching role mappings:', error);
            throw error;
        }
    };

    // Query Knowledge Base for relevant context
    const queryKnowledgeBase = async (question: string, sourceIds: string[]): Promise<string> => {
        if (!sourceIds || sourceIds.length === 0) return '';

        try {
            const response = await fetch('http://localhost:3005/tools/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Wallet-Address': userAddress || ''
                },
                body: JSON.stringify({
                    storeName: '', // Query across all selected sources
                    query: question,
                    sourceIds: sourceIds
                }),
            });

            if (!response.ok) return '';

            const data = await response.json();
            if (data.success && data.response) {
                return `\n\n[Knowledge Base Context]:\n${data.response}`;
            }
            return '';
        } catch (error) {
            console.error('Error querying Knowledge Base:', error);
            return '';
        }
    };

    // Fetch user's selected MCP sources from notebooks (for proper KB integration)
    // Uses same endpoints as FileSearchKnowledgeBase: /tools/list_stores and /tools/list_sources
    const fetchMCPSelectedSources = async (): Promise<{ sourceIds: string[]; storeName: string }> => {
        const MCP_ENDPOINT = process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3005';
        try {
            // Step 1: Get user's notebooks/stores using correct endpoint
            const storesRes = await fetch(`${MCP_ENDPOINT}/tools/list_stores`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userWallet: userAddress }),
            });

            if (!storesRes.ok) {
                console.log('[ChatBase] Failed to fetch MCP stores');
                return { sourceIds: [], storeName: 'default' };
            }

            const storesData = await storesRes.json();
            if (!storesData.success) {
                console.log('[ChatBase] MCP list_stores not successful');
                return { sourceIds: [], storeName: 'default' };
            }

            const notebooks = storesData.stores || [];
            console.log(`[ChatBase] Found ${notebooks.length} MCP notebooks`);

            // Step 2: Collect selected sources from each notebook
            const selectedSourceIds: string[] = [];
            let firstNotebookName = 'default';

            for (const nb of notebooks) {
                if (firstNotebookName === 'default') {
                    firstNotebookName = nb.name;
                }
                // Fetch sources for this notebook
                const sourcesRes = await fetch(`${MCP_ENDPOINT}/tools/list_sources`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeName: nb.name }),
                });
                if (sourcesRes.ok) {
                    const sourcesData = await sourcesRes.json();
                    const sources = sourcesData.sources || [];
                    for (const source of sources) {
                        if (source.isSelected || source.selected) {
                            selectedSourceIds.push(source.id);
                            console.log(`[ChatBase] Selected source: ${source.name || source.id}`);
                        }
                    }
                }
            }

            console.log(`[ChatBase] Found ${selectedSourceIds.length} selected MCP sources from ${notebooks.length} notebooks`);
            return { sourceIds: selectedSourceIds, storeName: firstNotebookName };
        } catch (error) {
            console.error('[ChatBase] Error fetching MCP sources:', error);
            return { sourceIds: [], storeName: 'default' };
        }
    };


    const handleCleanThread = async () => {
        try {
            const response = await fetch('/api/cleanup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ threadId: generatedThreadId }),
            });

            if (!response.ok) {
                throw new Error('Failed to clean thread');
            }
        } catch (error) {
            console.error('Error cleaning thread:', error);
        }
    };


    const handleRunAssistant = useCallback(debounce(async () => {
        if (isAssistantRun) return; // Prevent re-runs
        setIsLoading(true);

        try {
            let currentUser = user;
            let currentPrice = price;

            // Fetch user and price if not available
            if (!currentUser || !currentPrice) {
                const roleMappings = await fetchRoleMappings();
                currentUser = roleMappings.user;
                currentPrice = roleMappings.price;
            }

            if (!currentUser || !currentPrice) {
                console.log('User or price information not available');
                return;
            }

            // Process payment if price is available
            if (currentPrice) {
                // Get recipient address from role mappings (userAddress field)
                const roleMappings = await getRoleMappings(department, role);
                const recipientAddress = roleMappings.userAddress;

                const paymentSuccess = await process_payment(String(userAddress), currentPrice, recipientAddress || undefined);
                if (!paymentSuccess) {
                    const message = 'Insufficient balance. Unable to proceed with the request.';
                    toast.success(await getLocalizedString(message, language));

                    return;
                }
            }

            // Fetch questions and responses
            const existingQuestionsResponse = await fetch('/api/getQuestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threadId: generatedThreadId }),
            });

            const existingQuestionsData = await existingQuestionsResponse.json();

            if (existingQuestionsData.questions && existingQuestionsData.questions.length > 0) {
                // Existing questions found
                await handleExistingQuestions(existingQuestionsData.questions);
            } else {
                // No existing questions found, generate new ones
                await handleNewQuestions();
            }
            setIsAssistantRun(true); // Only set this after successful completion
        } catch (error) {
            console.error('Error running assistant:', error);
        } finally {
            setIsLoading(false);
        }
    }, 300), [user, price, userAddress, generatedThreadId, isAssistantRun]);  // 300ms debounce

    const handleExistingQuestions = async (questions: string[]) => {
        setNumQuestions(questions.length);
        const userQuestions: UserQuestions = {
            userId: userAddress!,
            questions: questions.map((q: string) => ({ question: q })),
        };

        const qaResponse = await fetch('/api/qa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userQuestions),
        });

        if (!qaResponse.ok) throw new Error('Failed to get QA response');

        const qaData: UserQA = await qaResponse.json();

        await processQAData(qaData);
    };

    /* const handleNewQuestions = async () => {
         const questionsText = await runAssistant(
             assistantId,
             "ask 5 pertinent questions designed to elicit as much detail as needed...",
             generatedThreadId
         );
     
         const questionList = extractQuestions(questionsText);
         setNumQuestions(questionList.length);
     
         // Fetch currently selected embeddings from backend
         // Corrected GET request using query parameters:
         const selectedSourcesResponse = await fetch(`/api/selectedSources/get?userAddress=${encodeURIComponent(userAddress!)}`, {
             method: 'GET',
             headers: { 'Content-Type': 'application/json' },
         });
     
     
         if (!selectedSourcesResponse.ok) throw new Error('Failed to fetch selected sources');
     
         const { selectedSources } = await selectedSourcesResponse.json();
     
         const userQuestions = {
             userAddress,
             questions: questionList.map((q) => ({ question: q })),
             role,
             task,
             selectedSources, // Pass current embeddings explicitly
         };
     
         const qaResponse = await fetch('/api/qa', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(userQuestions),
         });
     
         if (!qaResponse.ok) throw new Error('Failed to get QA response');
     
         const qaData = await qaResponse.json();
         await processQAData(qaData);
     };*/

    const handleNewQuestions = async () => {
        // Fetch currently selected embeddings from backend (Pinecone sources)
        const selectedSourcesResponse = await fetch(`/api/selectedSources/get?userAddress=${encodeURIComponent(userAddress!)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!selectedSourcesResponse.ok) throw new Error('Failed to fetch selected sources');
        const { selectedSources } = await selectedSourcesResponse.json();

        // Fetch MCP Knowledge Base sources (actual source IDs from MCP server)
        const mcpSources = await fetchMCPSelectedSources();
        console.log(`[ChatBase] MCP sources for Q&A: ${mcpSources.sourceIds.length} sources from store "${mcpSources.storeName}"`);

        // First, retrieve saved questions for this task
        const savedQuestionsResponse = await fetch('/api/getSavedQuestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userAddress,
                role,
                task,
                selectedSources
            }),
        });

        // Get previously saved questions
        let savedQuestions: string[] = [];
        if (savedQuestionsResponse.ok) {
            const data = await savedQuestionsResponse.json();
            savedQuestions = data.questions || [];
            console.log(`Retrieved ${savedQuestions.length} saved questions`);
        }

        // Determine how many new questions are needed
        const numNewQuestionsNeeded = Math.max(0, 5 - savedQuestions.length);
        console.log(`Need to generate ${numNewQuestionsNeeded} new questions`);

        // Only generate new questions if needed
        let newQuestions: string[] = [];
        if (numNewQuestionsNeeded > 0) {
            const questionsText = await runAssistant(
                assistantId,
                `ask ${numNewQuestionsNeeded} pertinent questions designed to elicit as much detail as needed...`,
                generatedThreadId
            );

            newQuestions = extractQuestions(questionsText).slice(0, numNewQuestionsNeeded);
            console.log(`Generated ${newQuestions.length} new questions`);
        }

        // Create combined questions array with saved questions marked
        const combinedQuestions = [
            ...savedQuestions.map(q => ({ question: q, saveToTaskChecked: true })),
            ...newQuestions.map(q => ({ question: q }))
        ];

        // Store all original questions for reference
        setOriginalQuestions([...savedQuestions, ...newQuestions]);
        setNumQuestions(combinedQuestions.length);

        // Prepare request to get answers - use MCP source IDs for proper KB integration
        const userQuestions = {
            userId: userAddress!,
            questions: combinedQuestions,
            role,
            task,
            selectedSources,
            kbSelectedSources: mcpSources.sourceIds, // Use actual MCP source IDs (not Pinecone IDs)
            storeName: mcpSources.storeName, // Pass the MCP store name
            useSavedAnswers: true // Flag to tell backend to use saved answers when available
        };

        const qaResponse = await fetch('/api/qa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userQuestions),
        });

        if (!qaResponse.ok) throw new Error('Failed to get QA response');

        const qaData = await qaResponse.json();
        await processQAData(qaData);
    };



    const processQAData = async (qaData: UserQA) => {
        const originalQuestionsTemp = [...originalQuestions];

        // Translate questions and answers if the language is not English
        if (language.toLowerCase() !== 'english' && language.toLowerCase() !== 'en') {
            for (let qa of qaData.qa) {
                originalQuestionsTemp.push(qa.question); // Store the original English question
                qa.question = await translateViaApi('Question', qa.question, 'English', language);
                qa.answer = await translateViaApi('Answer', qa.answer, 'English', language);
            }
        }

        setOriginalQuestions(originalQuestionsTemp);

        const formattedQA = qaData.qa
            .map((qa: QuestionAnswer) => `Q: ${qa.question}\n\nA: ${qa.answer}`)
            .join('\n\n---\n\n');

        setQAResponse(formattedQA);
        setEditableQA(qaData.qa);
        setIsJsonFormat(false);
        setIsEditing(false);

        // Pre-check checkboxes for saved questions
        const updatedSaveToTaskChecks = qaData.qa.map((qa) => qa.saveToTaskChecked || false);
        setSaveToTaskChecks(updatedSaveToTaskChecks);
    };


    const runAssistant = async (assistantId: string, message: string, threadId: string): Promise<string> => {
        const response = await fetch('/api/runAssistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assistantId, userMessage: message, threadId, userAddress }),
        });
        if (!response.ok) {
            throw new Error('Failed to run assistant');
        }
        const data = await response.json();
        return data.response;
    };

    function extractQuestions(input: string): string[] {
        const lines = input.split('\n');
        const questions: string[] = [];

        for (let i = 0; i < lines.length && questions.length < 5; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('📌')) {
                // Remove leading numbers and dots if present
                const question = line.replace(/^\d+\.\s*/, '').trim();
                questions.push(question);
            }
        }

        return questions;
    }

    const toggleEdit = () => {
        if (isEditing) {
            // Switching from edit mode to show mode
            const formatted = editableQA.map((qa: QuestionAnswer) =>
                `Q: ${qa.question}\n\nA: ${qa.answer}`
            ).join('\n\n---\n\n');
            setQAResponse(formatted);
        } else {
            // Switching from show mode to edit mode
            const qaPairs = qaResponse.split('\n\n---\n\n');
            const parsedQA = qaPairs.map((pair: string) => {
                const [question, answer] = pair.split('\n\nA: ');
                return {
                    question: question.replace('Q: ', '').trim(),
                    answer: answer.trim()
                };
            });
            setEditableQA(parsedQA);
        }
        setIsEditing(!isEditing);
    };

    const handleAnswerChange = (index: number, newAnswer: string) => {
        const updatedQA = [...editableQA];
        updatedQA[index].answer = newAnswer;
        setEditableQA(updatedQA);

        // Auto-check the checkbox when answer is edited
        const updatedChecks = [...saveToTaskChecks];
        updatedChecks[index] = true;
        setSaveToTaskChecks(updatedChecks);
    };


    const handleAnswerSubmit = async (checksToSubmit?: boolean[]) => {
        setIsLoading(true);
        try {
            const editedQAPairs = editableQA.map((qa, index) => ({
                question: originalQuestions[index] || qa.question,
                answer: qa.answer,
                saveToTask: checksToSubmit ? checksToSubmit[index] : saveToTaskChecks[index],
            }));

            console.log('Submitting Q&A pairs:', editedQAPairs);

            const selectedSourcesResponse = await fetch(`/api/selectedSources/get?userAddress=${encodeURIComponent(userAddress!)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!selectedSourcesResponse.ok) throw new Error('Failed to fetch selected sources');

            const { selectedSources } = await selectedSourcesResponse.json();

            const userQA = {
                userId: userAddress!,
                qa: editedQAPairs,
                role,
                task,
                selectedSources,
                kbSelectedSources, // Pass KB sources for source-tied self-learning
            };

            const response = await fetch('/api/qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userQA),
            });

            // Self-learning: Update MCP server with edited answers for RAG improvement
            if (kbSelectedSources && kbSelectedSources.length > 0) {
                const MCP_ENDPOINT = process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3005';
                for (const qa of editedQAPairs) {
                    if (qa.saveToTask) {
                        try {
                            await fetch(`${MCP_ENDPOINT}/tools/update_answer`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    question: qa.question,
                                    newAnswer: qa.answer,
                                    sourceIds: kbSelectedSources,
                                }),
                            });
                            console.log(`[Self-Learning] Updated RAG with answer for: ${qa.question.substring(0, 50)}...`);
                        } catch (e) {
                            console.warn('[Self-Learning] Failed to update MCP server:', e);
                        }
                    }
                }
            }

            if (response.ok) {
                const formatted = editableQA.map((qa) =>
                    `Q: ${qa.question}\n\nA: ${qa.answer}`
                ).join('\n\n---\n\n');

                setQAResponse(formatted);
                setIsEditing(false);
                setShowChatStream(true);

            } else {
                console.error('Error submitting answers');
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const translateViaApi = async (name: string, description: string, fromLanguage: string, toLanguage: string): Promise<string> => {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, fromLanguage, toLanguage }),
        });

        if (!response.ok) {
            console.error('Failed to translate');
            return description; // Return original if translation fails
        }

        const data = await response.json();
        return data.translatedText || description;
    };

    const handleAskAdditionalQuestions = async () => {
        if (!userAddress) {
            console.log('User address not available');
            return;
        }

        setIsLoading(true);
        try {
            // Include previous questions to avoid duplicates
            const previousQuestionsArray = editableQA.map(qa => qa.question);
            const previousQuestions = previousQuestionsArray.join('\n');

            // Prepare the prompt for OpenAI
            const prompt = `Based on the following task: ${task}, please generate 5 new and unique questions that have not been asked before. Previously asked questions are:\n${previousQuestions}\nEnsure the new questions are different from any of these. Return the questions only, one question per line.`;

            // Call the new API endpoint to get the questions
            const response = await fetch('/api/generateQuestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate questions');
            }

            const data = await response.json();
            const questionsText = data.questions;

            console.log('Generated questions:', questionsText);

            const questionList = extractQuestions(questionsText);

            // Proceed with the rest of your logic
            // Filter out duplicate questions
            const newQuestions = questionList.filter(q => !previousQuestionsArray.includes(q));

            // Use the new questions
            if (newQuestions.length === 0) {
                console.log('No new questions could be generated.');
                toast.error('No new questions could be generated. Please try again later.');
                setIsLoading(false);
                return;
            }

            // Proceed with payment processing and fetching answers
            let currentUser = user;
            let currentPrice = price;

            // Fetch user and price if not available
            if (!currentUser || !currentPrice) {
                const roleMappings = await fetchRoleMappings();
                currentUser = roleMappings.user;
                currentPrice = roleMappings.price;
            }

            if (!currentUser || !currentPrice) {
                console.log('User or price information not available');
                setIsLoading(false);
                return;
            }

            // Get recipient address for payment
            const roleMappings = await fetchRoleMappings();
            const recipientAddress = roleMappings.userAddress;
            const paymentSuccess = await process_payment(String(userAddress), currentPrice, recipientAddress || undefined);

            if (!paymentSuccess) {
                const message = 'Insufficient balance. Unable to proceed with the request.';
                toast.error(await getLocalizedString(message, language));
                setIsLoading(false);
                return;
            }
            //update usage
            // **Start of New Code: Update Usage Count**
            try {
                const updateResponse = await fetch('/api/updateUsage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        department,
                        role,
                        increment: 1, // Increment usage by 1
                    }),
                });

                if (!updateResponse.ok) {
                    // Handle non-2xx HTTP responses
                    const errorData = await updateResponse.json();
                    console.error('Failed to update usage:', errorData.message || updateResponse.statusText);
                    // Optionally, notify the user about the failure
                    //toast.error('Failed to update usage count. Please try again.');
                } else {
                    const data = await updateResponse.json();
                    console.log(`Usage count updated successfully. New usage: ${data.usage}`);
                    // Optionally, you can update local state or perform other actions based on the new usage count
                }
            } catch (error) {
                // Handle network or other unforeseen errors
                console.error('Error updating usage:', error);
                toast.error('An error occurred while updating usage count.');
            }
            // **End of New Code** 

            // Save the new questions (optional)
            await fetch('/api/saveQuestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ threadId: generatedThreadId, questions: newQuestions }),
            });

            // Prepare userQuestions with new questions
            const userQuestions: UserQuestions = {
                userId: userAddress!,
                questions: newQuestions.map(q => ({ question: q })),
                role,     // Include role information
                task      // Include task information
            };

            const qaResponse = await fetch('/api/qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userQuestions),
            });

            if (!qaResponse.ok) {
                throw new Error('Failed to get QA response');
            }

            const qaData: UserQA = await qaResponse.json();

            // Update numQuestions
            setNumQuestions(qaData.qa.length);

            // Update originalQuestions
            let updatedOriginalQuestions: string[] = [];

            if (language.toLowerCase() !== 'english' && language.toLowerCase() !== 'en') {
                for (let qa of qaData.qa) {
                    updatedOriginalQuestions.push(qa.question);
                    qa.question = await translateViaApi('Question', qa.question, 'English', language);
                    qa.answer = await translateViaApi('Answer', qa.answer, 'English', language);
                }
                setOriginalQuestions(updatedOriginalQuestions);
            } else {
                updatedOriginalQuestions = qaData.qa.map(qa => qa.question);
                setOriginalQuestions(updatedOriginalQuestions);
            }

            // Update the QA data after translation
            const formattedQA = qaData.qa.map((qa: QuestionAnswer) =>
                `Q: ${qa.question}\n\nA: ${qa.answer}`
            ).join('\n\n---\n\n');

            // Overwrite the previous Q&A with the new one
            setQAResponse(formattedQA);
            setEditableQA(qaData.qa);

        } catch (error) {
            console.error('Error asking additional questions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>

            {isLoading && (
                <div className={styles.loadingIndicator}>
                    <LocalizedText name="AI is thinking" />...
                </div>
            )}
            {qaResponse && !showChatStream && (
                <div className={styles.qaContainer}>
                    <div className={styles.qaHeader}>
                        <h3 className={styles.qaTitle}>
                            <LocalizedText name="Q&A" />:
                        </h3>
                        <div className={styles.buttonContainer}>
                            {/* Submit Answers Button - only button now */}
                            <div className={styles.tooltipWrapper}>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleAnswerSubmit();
                                    }}
                                    className={styles.submitButton}
                                    disabled={isLoading}
                                    aria-label='Submit Answers'
                                >
                                    {isLoading ? <LocalizedText name="Submitting..." /> : <LocalizedText name="Submit Answers" />}
                                </button>
                                <span className={styles.tooltip}>
                                    <LocalizedText name="Submit answers to start processing" />
                                </span>
                            </div>
                        </div>
                    </div>
                    <QAResponse
                        qaResponse={qaResponse}
                        isEditing={isEditing}
                        editableQA={editableQA}
                        editableQAForEmbed={editableQAForEmbed}
                        toggleEdit={toggleEdit}
                        handleAnswerChange={handleAnswerChange}
                        handleAnswerSubmit={handleAnswerSubmit}
                        numQuestions={numQuestions}
                        isLoading={isLoading}
                        saveToTaskChecks={saveToTaskChecks} // pass down state
                        setSaveToTaskChecks={setSaveToTaskChecks} // pass down setter
                    />
                </div>
            )}
            {showChatStream && (
                <div className={styles.chatStreamContainer}>
                    <ChatBaseStream
                        key={`${role}-${department}`}
                        role={role}
                        task={task}
                        initialMessage={qaResponse ? `Please proceed to the task in language:${language} based on the following Q&A information ${qaResponse} and continue in that language.` : ''}
                        department={department}
                        user={user}
                        price={price}
                    />
                </div>
            )}
        </div>
    );





};

export default ChatBase;
