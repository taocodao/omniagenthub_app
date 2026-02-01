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

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export const runtime = "edge";

interface ChatBaseStreamProps {
    role: string;
    task: string;
    initialMessage: string;
    department: string;
    user: string | null;
    price: number | null;
    onSaveProfile?: (profileData: any, profileName: string, profileId?: string) => Promise<void>;
    isEditingProfile?: boolean;
    onCancelProfile?: () => void;
    existingProfileName?: string; // NEW: Add existing profile name for editing
    existingProfileId?: string; // NEW: Add existing profile ID
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    id?: string;
}

interface ExtractedProfileData {
    business: string;
    USP: string;
    persona: string;
    challenges: string;
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

export function ChatBaseStream1({
    role,
    task,
    initialMessage,
    department,
    user,
    price,
    onSaveProfile,
    isEditingProfile,
    onCancelProfile,
    existingProfileName,      // NEW: Receive existing profile name
    existingProfileId // NEW: Receive existing profile ID
}: ChatBaseStreamProps) {

    const [profileData, setProfileData] = useState<ExtractedProfileData | null>(null);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [profileName, setProfileName] = useState(existingProfileName || ''); // FIXED: Use existing name
    const { process_payment } = usePayment();
    const [isRefining, setIsRefining] = useState(false);
    const account = useActiveAccount();  // ← KEEP THIS HERE
    const userAddress = account?.account?.address;  // ← KEEP THIS HERE
    //const [userAddress, setUserAddress] = useState<string | undefined>(undefined);
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


    // FIXED: Simple and reliable extraction based on single-quote format
    const extractProfileDataFromContent = (content: string): ExtractedProfileData => {
        console.log('Extracting profile data from content:', content);

        const keywords = ['business', 'USP', 'persona', 'challenges'];
        const result: { [key: string]: string } = {};

        for (const keyword of keywords) {
            // FIXED: Regex pattern to find keyword followed by colon and single quoted content
            const pattern = new RegExp(`${keyword}:\\s*'([^']*)'`, 'gis');
            const matches = [];
            let match;

            // Find all matches for this keyword
            while ((match = pattern.exec(content)) !== null) {
                const extractedContent = match[1].trim();
                if (extractedContent.length > 0) {
                    matches.push(extractedContent);
                }
            }

            // Take the LAST occurrence (most recent iteration)
            if (matches.length > 0) {
                result[keyword] = matches[matches.length - 1];
                console.log(`Found ${matches.length} occurrences of ${keyword}, using last one:`, result[keyword].substring(0, 100) + '...');
            } else {
                result[keyword] = '';
                console.log(`No matches found for ${keyword}`);
            }
        }

        // Final validation and cleanup
        const finalResult = {
            business: result.business || '',
            USP: result.USP || '',
            persona: result.persona || '',
            challenges: result.challenges || ''
        };

        console.log('Final extracted data:', {
            business: finalResult.business ? finalResult.business.substring(0, 100) + '...' : 'empty',
            USP: finalResult.USP ? finalResult.USP.substring(0, 100) + '...' : 'empty',
            persona: finalResult.persona ? finalResult.persona.substring(0, 100) + '...' : 'empty',
            challenges: finalResult.challenges ? finalResult.challenges.substring(0, 100) + '...' : 'empty'
        });

        return finalResult;
    };


    // Function to check profile name uniqueness
    const checkProfileNameUniqueness = async (name: string): Promise<boolean> => {
        try {
            const response = await fetch(`/api/check-profile-name?userAddress=${userAddress}&name=${encodeURIComponent(name)}`);
            const result = await response.json();
            return !result.exists;
        } catch (error) {
            console.error('Error checking profile name:', error);
            return false;
        }
    };

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
            inputRef.current.style.height = '';
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



    // FIXED Issue 3: Set profile name when editing
    useEffect(() => {
        if (isEditingProfile && existingProfileName) {
            setProfileName(existingProfileName);
        }
    }, [isEditingProfile, existingProfileName]);

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

            try {
                const updateResponse = await fetch('/api/updateUsage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        department,
                        role,
                        increment: 1,
                    }),
                });

                if (!updateResponse.ok) {
                    const errorData = await updateResponse.json();
                    console.error('Failed to update usage:', errorData.message || updateResponse.statusText);
                } else {
                    const data = await updateResponse.json();
                    console.log(`Usage count updated successfully. New usage: ${data.usage}`);
                }
            } catch (error) {
                console.error('Error updating usage:', error);
                toast.error('An error occurred while updating usage count.');
            }
        }

        append({ role: 'user', content: message });
        await submitMessage();
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

    const extractAction = (content: string) => {
        const colonIndex = content.indexOf(':');
        if (colonIndex !== -1) {
            return content.substring(0, colonIndex).trim();
        }
        return content.trim();
    };

    const handleSaveProfile = async () => {
        try {
            const assistantMessages = messages.filter(m => m.role === 'assistant');

            if (assistantMessages.length === 0) {
                toast.error(await getLocalizedString('No assistant response found to save', language));
                return;
            }

            const lastMessage = assistantMessages[assistantMessages.length - 1];
            console.log('Processing last assistant message for profile extraction...');

            const extractedData = extractProfileDataFromContent(lastMessage.content);

            if (!extractedData.business || !extractedData.USP || !extractedData.persona || !extractedData.challenges) {
                const missingFields = [];
                if (!extractedData.business) missingFields.push('Business');
                if (!extractedData.USP) missingFields.push('USP');
                if (!extractedData.persona) missingFields.push('Persona');
                if (!extractedData.challenges) missingFields.push('Challenges');

                toast.error(await getLocalizedString(`Profile data incomplete. Missing fields: ${missingFields.join(', ')}. Please ensure all fields are present in the latest response.`, language));
                return;
            }

            console.log('Successfully extracted profile data');
            setProfileData(extractedData);
            setShowConfirmDialog(true);
        } catch (error) {
            console.error('Error processing profile data:', error);
            toast.error(await getLocalizedString('Error processing profile data', language));
        }
    };

    const handleConfirmProfile = () => {
        setShowConfirmDialog(false);
        // FIXED Issue 3: For editing, skip name input dialog
        if (isEditingProfile && existingProfileName) {
            handleFinalSave();
        } else {
            setShowSaveDialog(true);
        }
    };

    const handleFinalSave = async () => {
        const nameToUse = isEditingProfile && existingProfileName ? existingProfileName : profileName.trim();

        if (!nameToUse) {
            toast.error(await getLocalizedString('Please enter a profile name', language));
            return;
        }

        // FIXED Issue 3: Skip uniqueness check for editing
        if (!isEditingProfile || (isEditingProfile && nameToUse !== existingProfileName)) {
            const isUnique = await checkProfileNameUniqueness(nameToUse);
            if (!isUnique) {
                toast.error(await getLocalizedString(`Profile name "${nameToUse}" already exists. Please choose a different name.`, language));
                return;
            }
        }

        if (onSaveProfile && profileData) {
            await onSaveProfile(profileData, nameToUse, isEditingProfile ? existingProfileId : undefined);
            setShowSaveDialog(false);
            setProfileName('');
            setProfileData(null);
            if (onCancelProfile) onCancelProfile();
        }
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
                    <button type="button" className={styles.cardButton} onClick={() => submitQuestion(userInput)} disabled={isLoading}>
                        <LocalizedText name='Send' />
                    </button>
                </form>

                {/* Profile Confirmation Dialog */}
                {showConfirmDialog && profileData && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent} style={{
                            padding: '2rem',
                            maxWidth: '800px',
                            maxHeight: '80vh',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            overflow: 'auto'
                        }}>
                            <h3 style={{ marginBottom: '1rem', color: '#333', textAlign: 'center' }}>
                                <LocalizedText name="Confirm Profile Data" />
                            </h3>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ color: '#555', marginBottom: '0.5rem' }}>Business:</h4>
                                <div style={{
                                    padding: '1rem',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '4px',
                                    marginBottom: '1rem',
                                    maxHeight: '150px',
                                    overflow: 'auto',
                                    color: 'black'
                                }}>
                                    {profileData.business}
                                </div>

                                <h4 style={{ color: '#555', marginBottom: '0.5rem' }}>USP:</h4>
                                <div style={{
                                    padding: '1rem',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '4px',
                                    marginBottom: '1rem',
                                    maxHeight: '150px',
                                    overflow: 'auto',
                                    color: 'black'
                                }}>
                                    {profileData.USP}
                                </div>

                                <h4 style={{ color: '#555', marginBottom: '0.5rem' }}>Persona:</h4>
                                <div style={{
                                    padding: '1rem',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '4px',
                                    marginBottom: '1rem',
                                    maxHeight: '150px',
                                    overflow: 'auto',
                                    color: 'black'
                                }}>
                                    {profileData.persona}
                                </div>

                                <h4 style={{ color: '#555', marginBottom: '0.5rem' }}>Challenges:</h4>
                                <div style={{
                                    padding: '1rem',
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: '4px',
                                    marginBottom: '1rem',
                                    maxHeight: '150px',
                                    overflow: 'auto',
                                    color: 'black'
                                }}>
                                    {profileData.challenges}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setShowConfirmDialog(false);
                                        setProfileData(null);
                                    }}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#666',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <LocalizedText name="Cancel" />
                                </button>
                                <button
                                    onClick={handleConfirmProfile}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#4CAF50',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <LocalizedText name="Confirm & Continue" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FIXED Issue 3: Profile Name Input Dialog - Only show for new profiles */}
                {showSaveDialog && profileData && !isEditingProfile && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalContent} style={{
                            padding: '2rem',
                            maxWidth: '400px',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                            <h3 style={{ marginBottom: '1rem', color: 'darkblue', textAlign: 'center' }}>
                                <LocalizedText name="Save Profile" />
                            </h3>
                            <input
                                type="text"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                placeholder="Enter profile name..."
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    marginBottom: '1rem',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    fontSize: '16px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                                autoFocus
                            />
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        setShowSaveDialog(false);
                                        setProfileName('');
                                        setProfileData(null);
                                    }}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#666',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <LocalizedText name="Cancel" />
                                </button>
                                <button
                                    onClick={handleFinalSave}
                                    disabled={!profileName.trim()}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: !profileName.trim() ? '#ccc' : '#4CAF50',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: !profileName.trim() ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    <LocalizedText name="Save" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Profile action buttons for User Research Collector */}
                {role === "User Research Collector" && onSaveProfile && messages.length > 0 && (
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        padding: '1rem',
                        borderTop: '1px solid #ccc',
                        justifyContent: 'center',
                        backgroundColor: '#f8f9fa'
                    }}>
                        <button
                            onClick={handleSaveProfile}
                            style={{
                                padding: '0.75rem 1.5rem',
                                backgroundColor: 'blue',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '16px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                            disabled={messages.filter(m => m.role === 'assistant').length === 0}
                        >
                            <LocalizedText name={isEditingProfile ? "Update Profile" : "Save Profile"} />
                        </button>
                        {onCancelProfile && (
                            <button
                                onClick={onCancelProfile}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <LocalizedText name="Cancel" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
