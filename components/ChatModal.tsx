// components/ChatModal.tsx

import React, { useState, useEffect, ChangeEvent, useContext } from 'react';
import styles from '../styles/ChatModal.module.css'; // Ensure this CSS module exists and is properly styled
import { toast } from 'react-toastify';
import { LocalizationContext } from '../util/LocalizationContext';
import { LocalizedText, getLocalizedString } from '../util/LocalizedText'; // Ensure getLocalizedString is exported

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;

}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
    const { language } = useContext(LocalizationContext);
    const [input, setInput] = useState<{ query: string }>({ query: '' });
    const [messages, setMessages] = useState<any[]>([]);
    const [chatDepartments, setChatDepartments] = useState<string[]>([]);
    const [chatRoles, setChatRoles] = useState<string[]>(['ALL']);
    const [selectedChatDepartment, setSelectedChatDepartment] = useState<string>('ALL');
    const [selectedChatRole, setSelectedChatRole] = useState<string>('ALL');

    // Handle input changes for chat input
    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInput({ query: e.target.value });
    };

    // Format results from API response with hyperlinks
    const formatResults = (results: any[]) => {
        if (!results || results.length === 0) {
            return <LocalizedText name="NoMatchingTasksFound" />; // Localized message
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

        const formattedResults = results.map((result, index) => {
            const encodedRole = encodeURIComponent(result.role);
            const encodedDepartment = encodeURIComponent(result.department);
            const encodedTask = encodeURIComponent(result.task);
            let url = `${baseUrl}/ChatHome?selectedRole=${encodedRole}&selectedCategory=${encodedDepartment}&selectedTask=${encodedTask}`;
            // **Add language parameter if language is not English**
            if (language && language.toLowerCase() !== 'english') {
                url += `&language=${encodeURIComponent(language)}`;
            }

            console.log("-----------the url is ", url);
            return (
                <div key={index} className={styles.resultItem}>
                    <strong><LocalizedText name="Category" />:</strong> <LocalizedText name={result.department} />
                    <br />
                    <strong><LocalizedText name="Persona" />:</strong> <LocalizedText name={result.role} />
                    <br />
                    <strong><LocalizedText name="Task" />:</strong>{' '}
                    <a href={url} target="_blank" rel="noopener noreferrer">
                        <LocalizedText name={result.task} />
                    </a>
                    <br />
                    <strong><LocalizedText name="Score" />:</strong> {result.score.toFixed(2)}
                    <hr />
                </div>
            );
        });

        return <div>{formattedResults}</div>;
    };

    // Handle form submission for chat
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const payload: any = {
            query: input.query,
        };

        if (selectedChatDepartment !== 'ALL') {
            payload.department = selectedChatDepartment;
        }

        if (selectedChatRole !== 'ALL') {
            payload.role = selectedChatRole;
        }

        try {
            const response = await fetch('/api/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                // Process and display the results
                setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        role: 'user',
                        content: input.query,
                    },
                    {
                        role: 'assistant',
                        content: formatResults(data.results),
                    },
                ]);
            } else {
                // Handle error response
                setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        role: 'assistant',
                        content: data.error || <LocalizedText name="AnErrorOccurred" />, // Localized error message
                    },
                ]);
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    role: 'assistant',
                    content: <LocalizedText name="ErrorProcessingRequest" />, // Localized error message
                },
            ]);
        }

        // Reset the input field
        setInput({ query: '' });
    };

    // Fetch departments for the chat modal
    useEffect(() => {
        const fetchChatDepartments = async () => {
            try {
                const response = await fetch('/api/get-departments');
                if (!response.ok) {
                    throw new Error('Failed to fetch departments');
                }
                const data = await response.json();
                setChatDepartments(['ALL', ...data]); // Include 'ALL' as default option
            } catch (error) {
                console.error('Error fetching departments:', error);
                toast.error(<LocalizedText name="FailedToFetchDepartments" />);
            }
        };
        fetchChatDepartments();
    }, []);

    // Fetch roles based on selected department for the chat modal
    useEffect(() => {
        if (selectedChatDepartment === 'ALL') {
            setChatRoles(['ALL']);
            setSelectedChatRole('ALL');
        } else {
            const fetchChatRoles = async () => {
                try {
                    const response = await fetch('/api/get-roles', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ department: selectedChatDepartment }),
                    });
                    if (!response.ok) {
                        throw new Error('Failed to fetch roles');
                    }
                    const data = await response.json();
                    const roles = Array.isArray(data.roles) ? data.roles : [];
                    setChatRoles(['ALL', ...roles]);
                    setSelectedChatRole('ALL');
                } catch (error) {
                    console.error('Error fetching roles:', error);
                    toast.error(<LocalizedText name="FailedToFetchRoles" />);
                }
            };
            fetchChatRoles();
        }
    }, [selectedChatDepartment]);

    // Close the modal when the Escape key is pressed
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        } else {
            document.removeEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    // Prevent background scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    const [localizedPlaceholder, setLocalizedPlaceholder] = useState("What is your primary objective for this task?");

    useEffect(() => {
        const updatePlaceholder = async () => {
            const placeholderText = await getLocalizedString("What is your primary objective for this task?", language);
            setLocalizedPlaceholder(placeholderText);
        };
        updatePlaceholder();
    }, [language]);

    if (!isOpen) return null;



    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                {/* Close Button */}
                <button className={styles.closeButton} onClick={onClose} aria-label="Close Modal">
                    &times;
                </button>
                {/* Department and Role Selectors */}
                <div className={styles.chatSelectors}>
                    <label className={styles.selectorLabel}>
                        <LocalizedText name="Category" />:
                        <select
                            value={selectedChatDepartment}
                            onChange={(e) => setSelectedChatDepartment(e.target.value)}
                            className={styles.chatDropdown}
                            aria-label="Select Department"
                        >
                            {chatDepartments.map((dept) => (
                                <option key={dept} value={dept}>
                                    {dept === 'ALL' ? <LocalizedText name="All" /> : <LocalizedText name={dept} />}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.selectorLabel}>
                        <LocalizedText name="Persona" />:
                        <select
                            value={selectedChatRole}
                            onChange={(e) => setSelectedChatRole(e.target.value)}
                            className={styles.chatDropdown}
                            aria-label="Select Role"
                        >
                            {chatRoles.map((role) => (
                                <option key={role} value={role}>
                                    {role === 'ALL' ? <LocalizedText name="All" /> : <LocalizedText name={role} />}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className={styles.chatContainer}>
                    {/* Chat messages */}
                    {messages.map((message: any, index: number) => (
                        <div
                            key={index}
                            className={
                                message.role === 'user'
                                    ? styles.userMessage
                                    : styles.assistantMessage
                            }
                        >
                            {message.role === 'assistant' ? (
                                <div className={styles.assistantContent}>{message.content}</div>
                            ) : (
                                <div className={styles.userContent}>{message.content}</div>
                            )}
                        </div>
                    ))}
                    {/* Input form */}
                    <form onSubmit={handleSubmit} className={styles.chatInputForm}>
                        <input
                            name="query"
                            value={input.query}
                            onChange={handleInputChange}
                            placeholder={localizedPlaceholder}
                            className={styles.chatInput}
                            required
                            aria-label="Chat Input"
                        />
                        <button type="submit" className={styles.sendButton}>
                            <LocalizedText name="Search" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatModal;
