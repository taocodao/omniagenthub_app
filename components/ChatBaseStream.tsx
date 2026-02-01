'use client';


import React, { useState, useEffect, useRef, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import styles from "../styles/Home5.module.css";
import HashUtil from '../util/hashToFixedDigits';
import { useActiveAccount } from '../hooks/useWalletAddress';
import { LocalizedText, useLocalizedString, getLocalizedString } from '../util/LocalizedText';
import { LocalizationContext } from '../util/LocalizationContext';
import { usePayment } from '../hook/Payment_Process';
import { useAssistant } from 'ai/react';
import ReactDOM from 'react-dom/client';
import { toast } from 'react-toastify';

export const maxDuration = 300; // This function can run for a maximum of 300 seconds

export const dynamic = 'force-dynamic';


export const runtime = "edge";

interface ChatBaseStreamProps {
    role: string;
    task: string;
    initialMessage: string;
    department: string;
    user: string | null;
    price: number | null;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    id?: string;
}


const options = [
    'Enhance Based on Previous Feedback or Additional Input',
    'Conduct a More Rigorous Assessment',
    'Gather Detail for Customization by Answering More Questions',
    'Simulate Comprehensive Focus Group Insights For Better Work',
    'Replicate Diverse Expert Opinions to Improve',
    'Explore Innovative Approaches to be Creative',
    'Adjust Presentation Style, Tone, or Scope',
    'Optimize for Peak Performance',
];

const optionShortNames: { [key: string]: string } = {
    'Enhance Based on Previous Feedback or Additional Input': 'Refine',
    'Conduct a More Rigorous Assessment': 'Evaluate',
    'Gather Detail for Customization by Answering More Questions': 'Personalize',
    'Simulate Comprehensive Focus Group Insights For Better Work': 'Focus Group',
    'Replicate Diverse Expert Opinions to Improve': 'Expert Feedback',
    'Explore Innovative Approaches to be Creative': 'Creative',
    'Adjust Presentation Style, Tone, or Scope': 'Modify',
    'Optimize for Peak Performance': 'Auto Improve',
};

const CustomTable: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ children, ...props }) => (
    <table className={styles.customTable} {...props}>
        {children}
    </table>
);

export function ChatBaseStream({ role, task, initialMessage, department, user, price }: ChatBaseStreamProps) {
    const { process_payment } = usePayment();
    const [isRefining, setIsRefining] = useState(false);
    const account = useActiveAccount();  // ← KEEP THIS HERE
    const userAddress = account?.account?.address;  // ← KEEP THIS HERE
    const assistantId = HashUtil.hashTo(role + task);
    const { language } = useContext(LocalizationContext);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [renderKey, setRenderKey] = useState(0);
    const initialMessageSentRef = useRef(false);
    const [optionLongNames, setOptionLongNames] = useState<{ [key: string]: string }>({});
    const { messages, append, submitMessage, status } = useAssistant({
        api: '/api/assistant1',
        body: {
            assistantId: assistantId,
            threadId: null,
            userAddress,
        },
    });
    const [userInput, setUserInput] = useState<string>('');
    const isLoading = status === 'in_progress';

    const updateOptionLongNames = async (language: string) => {
        const newOptionLongNames: { [key: string]: string } = {};
        const longNames = Object.keys(optionShortNames);
        for (let longName of longNames) {
            newOptionLongNames[optionShortNames[longName]] = await getLocalizedString(longName, language);
        }
        setOptionLongNames(newOptionLongNames);
    };

    const resetTextareaHeight = () => {
        if (inputRef.current) {
            //const rowHeight = window.getComputedStyle(inputRef.current).lineHeight;
            inputRef.current.style.height = '';//rowHeight;
        }
    };


    useEffect(() => {
        updateOptionLongNames(language);
    }, [language]);

    useEffect(() => {
        if (Object.keys(optionLongNames).length > 0) {
            setRenderKey(prev => prev + 1);
        }
    }, [optionLongNames]);

    useEffect(() => {
        if (initialMessage && !initialMessageSentRef.current && userAddress) {
            submitQuestion(initialMessage);
            initialMessageSentRef.current = true;
        }
    }, [initialMessage, userAddress]);



    const submitQuestion = async (message: string) => {
        if (isLoading) return;

        if (price) {
            //const isPaymentValid = await process_payment(String(userAddress), price, user);
            // ✅ AFTER:
            if (!userAddress) {
                toast.error(await getLocalizedString('Please connect your wallet', language));
                return;
            }

            // Fetch recipient address from role-mappings
            let recipientAddress: string | undefined;
            if (user) {
                try {
                    const res = await fetch('/api/get-role-mappings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ department, role }),
                    });
                    const data = await res.json();
                    recipientAddress = data.userAddress || undefined;
                } catch (e) {
                    console.error('Failed to fetch role mappings for payment:', e);
                }
            }

            const isPaymentValid = await process_payment(userAddress, price, recipientAddress);
            if (!isPaymentValid) {
                toast.info(await getLocalizedString('Insufficient balance', language));
                return;
            }
            // add update usage 
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



        }
        append({ role: 'user', content: message });

        await submitMessage();

        // Reset textarea height to 1 row after submit
        resetTextareaHeight();

        if (inputRef.current) {
            inputRef.current.value = '';
        }

        setIsRefining(false);
        setUserInput('');
    };

    const handleInputChange1 = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setUserInput(e.target.value);
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
        }
    };

    /*const handleButtonClick = async (action: string) => {
        const shortName = optionShortNames[action];
        if (shortName === 'Refine') {
            setIsRefining(true);
            inputRef.current?.focus();
        } else {
            setUserInput(shortName || action);
            await submitQuestion(shortName || action);
        }
    };*/
    const handleButtonClick = async (action: string) => {
        const shortName = optionShortNames[action];
        if (shortName === 'Refine') {
            await submitQuestion('Refine: ' + userInput);
            setUserInput('');
        } else {
            setUserInput(shortName || action);
            await submitQuestion(shortName || action);
        }
    };

    const handleRefineSubmit = async () => {
        if (isLoading) return;

        await submitQuestion('Refine: ' + userInput);

        setIsRefining(false);
        setUserInput('');
    };

    /* const copyToClipboard = async (content: string) => {
         try {
             const tempElement = document.createElement('div');
             tempElement.innerHTML = await renderMarkdownToHTML(content);
             await navigator.clipboard.write([
                 new ClipboardItem({
                     'text/html': new Blob([tempElement.innerHTML], { type: 'text/html' }),
                     'text/plain': new Blob([content], { type: 'text/plain' })
                 })
             ]);
             toast.info(await getLocalizedString('Copied to clipboard with formatting', language));
         } catch (err) {
             console.error("Failed to copy: ", err);
             await navigator.clipboard.writeText(content);
             toast.info(await getLocalizedString('Copied plain text to clipboard', language));
         }
     };*/
    const copyToClipboard = async (index: number) => {
        try {
            const messageElement = messageRefs.current[index];
            if (!messageElement) throw new Error('Message element not found');

            const html = messageElement.innerHTML;
            const text = messageElement.innerText;

            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                }),
            ]);

            toast.info(await getLocalizedString('Copied to clipboard with formatting', language));
        } catch (err) {
            console.error("Failed to copy: ", err);
            const messageElement = messageRefs.current[index];
            if (messageElement) {
                const text = messageElement.innerText;
                await navigator.clipboard.writeText(text);
                toast.info(await getLocalizedString('Copied plain text to clipboard', language));
            }
        }
    };


    const feedbackPlaceholder = useLocalizedString("Please type feedback or leave blank");
    const messagePlaceholder = useLocalizedString("Type your message");

    const renderMarkdownToHTML = async (markdown: string): Promise<string> => {
        return new Promise((resolve) => {
            const tempElement = document.createElement('div');

            const root = ReactDOM.createRoot(tempElement);

            const markdownElement = (
                <ReactMarkdown
                    rehypePlugins={[rehypeRaw]}
                    remarkPlugins={[remarkGfm]}
                    components={{
                        table: ({ children, ...props }) => (
                            <table style={{ borderCollapse: 'collapse', width: '100%' }} {...props}>
                                {children}
                            </table>
                        ),
                        th: ({ children, ...props }) => (
                            <th style={{ border: '1px solid black', padding: '8px', backgroundColor: '#f2f2f2' }} {...props}>
                                {typeof children === 'string' ? children : 'Fallback Text'}
                            </th>
                        ),
                        td: ({ children, ...props }) => (
                            <td style={{ border: '1px solid black', padding: '8px' }} {...props}>
                                {children}
                            </td>
                        ),
                    }}
                >
                    {markdown}
                </ReactMarkdown>
            );

            root.render(markdownElement);
            resolve(tempElement.innerHTML);
        });
    };

    const extractAction = (content: string) => {
        const colonIndex = content.indexOf(':');
        if (colonIndex !== -1) {
            return content.substring(0, colonIndex).trim();
        }
        return content.trim();
    };

    return (
        <div key={renderKey}>
            <div className={styles.container}>
                <div className={styles.chatContainer}>
                    {messages.map((message, index) => (
                        <div key={index} className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.aiMessage}`}>
                            <div className={message.role === 'user' ? styles.userMessageRole : styles.aiMessageRole}>
                                {message.role === 'user' ? <LocalizedText name={`User: ${task}`} /> : <LocalizedText name={role} />}
                            </div>
                            <div ref={(el) => { messageRefs.current[index] = el; }}>
                                <ReactMarkdown
                                    rehypePlugins={[rehypeRaw]}
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        table: ({ children, ...props }) => (
                                            <table className={styles.customTable} {...props}>
                                                {children}
                                            </table>
                                        ),
                                        thead: ({ children, ...props }) => (
                                            <thead {...props}>{children}</thead>
                                        ),
                                        tbody: ({ children, ...props }) => (
                                            <tbody {...props}>{children}</tbody>
                                        ),
                                        tr: ({ children, ...props }) => (
                                            <tr {...props}>{children}</tr>
                                        ),
                                        th: ({ children, ...props }) => (
                                            <th {...props}>{children}</th>
                                        ),
                                        td: ({ children, ...props }) => (
                                            <td {...props}>{children}</td>
                                        ),
                                        code: ({ node, className, children, ...props }) => {
                                            const match = /language-(\w+)/.exec(className || '');
                                            if (match && match[1] === 'html') {
                                                return <div dangerouslySetInnerHTML={{ __html: String(children).replace(/\n$/, '') }} />;
                                            }
                                            return <code className={className} {...props}>{children}</code>;
                                        },
                                    }}
                                >
                                    {message.role === 'user' && optionLongNames[extractAction(message.content)]
                                        ? optionLongNames[extractAction(message.content)]
                                        : message.content}
                                </ReactMarkdown>
                            </div>
                            {message.role === 'assistant' && (
                                <button onClick={() => copyToClipboard(index)} className={styles.copyButton} disabled={isLoading}>
                                    <LocalizedText name="Copy" />
                                </button>
                            )}
                        </div>
                    ))}

                    {isLoading && <div className={styles.loadingIndicator}><LocalizedText name="AI is thinking..." /></div>}
                </div>

                <div className={styles.buttonContainer}>
                    {options.map((option) => (
                        <div key={option} className={styles.buttonWrapper}>
                            <button onClick={() => handleButtonClick(option)} className={styles.cardButton} disabled={isLoading || isRefining}>
                                <LocalizedText name={optionShortNames[option]} />
                            </button>
                            <div className={styles.buttonTooltip}>
                                <LocalizedText name={option} />
                            </div>
                        </div>
                    ))}
                </div>

                <form className={styles.inputForm}>
                    <textarea
                        ref={inputRef}
                        className={`${styles.input} ${isRefining ? styles.refineInput : ''}`}
                        value={userInput}
                        onChange={handleInputChange1}
                        placeholder={isRefining ? feedbackPlaceholder : messagePlaceholder}
                        rows={1}
                        disabled={isLoading}
                    />
                    {/* <button
                        type="button"
                        className={styles.cardButton}
                        onClick={() => {
                            if (isRefining) {
                                handleRefineSubmit();
                            } else {
                                submitQuestion(userInput);
                            }
                        }}
                        disabled={isLoading}
                    >
                        <LocalizedText name={isRefining ? 'Refine' : 'Send'} />
                    </button>*/}
                    <button type="button" className={styles.cardButton} onClick={() => submitQuestion(userInput)} disabled={isLoading}>
                        <LocalizedText name='Send' />
                    </button>
                </form>
            </div>
        </div>
    );
}
