// components/BusinessChatModal.tsx

import React, { useState, useEffect, ChangeEvent, useContext, useRef } from 'react';
import styles from '../styles/ChatModal.module.css';
import { toast } from 'react-toastify';
import { LocalizationContext } from '../util/LocalizationContext';
import { LocalizedText, getLocalizedString } from '../util/LocalizedText';

interface BusinessChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BusinessChatModal: React.FC<BusinessChatModalProps> = ({ isOpen, onClose }) => {
    const { language } = useContext(LocalizationContext);
    const [input, setInput] = useState<{ query: string }>({ query: '' });
    const [messages, setMessages] = useState<any[]>([]);

    // States for task description modal
    const [isTaskModalVisible, setIsTaskModalVisible] = useState<boolean>(false);
    const [modalPosition, setModalPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [taskDescription, setTaskDescription] = useState<string | null>(null);
    const [activeButton, setActiveButton] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // Department and role states
    const [chatDepartments, setChatDepartments] = useState<string[]>([]);
    const [chatRoles, setChatRoles] = useState<string[]>(['ALL']);
    const [selectedChatDepartment, setSelectedChatDepartment] = useState<string>('ALL');
    const [selectedChatRole, setSelectedChatRole] = useState<string>('ALL');
    const [localizedPlaceholder, setLocalizedPlaceholder] = useState<string>("What is your primary objective for this task?");

    // Store non-entrepreneur departments for link checking
    const [nonEntrepreneurDepartments, setNonEntrepreneurDepartments] = useState<string[]>([]);

    // Handle input changes for chat input
    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInput({ query: e.target.value });
    };

    // Fetch non-entrepreneur group departments for the chat modal
    const fetchChatDepartments = async () => {
        try {
            const response = await fetch('/api/get-non-entrepreneur-group-departments');
            if (!response.ok) {
                throw new Error('Failed to fetch non-entrepreneur group departments');
            }
            const data = await response.json();
            const departments = Array.isArray(data.departments) ? data.departments : [];
            setChatDepartments(['ALL', ...departments]); // Include 'ALL' as default option
            setNonEntrepreneurDepartments(departments); // Store for link checking
        } catch (error) {
            console.error('Error fetching non-entrepreneur group departments:', error);
            toast.error(<LocalizedText name="Failed to fetch departments" />);
        }
    };

    // Function to handle task description click with enhanced button state management
    const handleDescriptionClick = async (event: React.MouseEvent<HTMLButtonElement>, task: string, role?: string) => {
        event.stopPropagation();
        // If clicking the same button that's already active, close the modal
        if (activeButton === task && isTaskModalVisible) {
            setIsTaskModalVisible(false);
            setActiveButton(null);
            setTaskDescription(null);
            return;
        }

        // Set this button as active and clear previous description
        setTaskDescription(null);
        setActiveButton(task);
        const targetElement = event.currentTarget;
        if (!targetElement) {
            console.error("event.currentTarget is null");
            return;
        }

        const rect = targetElement.getBoundingClientRect();
        setModalPosition({
            top: rect.top + window.scrollY,
            left: rect.right + 10 + window.scrollX
        });
        setIsTaskModalVisible(true);

        try {
            // Use the role from the result or fall back to selectedChatRole or 'ALL'
            const roleToUse = role || (selectedChatRole !== 'ALL' ? selectedChatRole : 'Digital Marketing Strategist');
            // Use selected department or fall back to first department
            const departmentToUse = selectedChatDepartment !== 'ALL' ? selectedChatDepartment : (chatDepartments.length > 1 ? chatDepartments[1] : 'Business');

            const response = await fetch("/api/get_task_description", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    department: departmentToUse,
                    role: roleToUse,
                    task,
                    language: language,
                }),
            });

            if (!response.ok) throw new Error("Failed to fetch task description");
            const data = await response.json();
            setTaskDescription(data.description);
        } catch (error) {
            console.error("Error fetching task description:", error);
            setTaskDescription("Failed to load task description. Please try again.");
        }
    };

    // Function to close modal when clicking outside
    const handleClickOutside = React.useCallback((event: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
            setIsTaskModalVisible(false);
            setActiveButton(null);
        }
    }, []);

    // Add event listener for clicking outside modal
    useEffect(() => {
        if (isTaskModalVisible) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTaskModalVisible, handleClickOutside]);

    // Format results from API response with hyperlinks and enhanced description buttons
    const formatResults = (results: any[]) => {
        if (!results || results.length === 0) {
            return <LocalizedText name="No results found." />;
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

        const formattedResults = results.map((result, index) => {
            const encodedRole = encodeURIComponent(result.role);
            const encodedDepartment = encodeURIComponent(result.department);
            const encodedTask = encodeURIComponent(result.task);

            // Check if department is in non-entrepreneur group departments
            const isBusinessDepartment = nonEntrepreneurDepartments.includes(result.department);

            // Choose the appropriate base URL based on department
            let url = `${baseUrl}/${isBusinessDepartment ? 'ChatHome_bus' : 'ChatHome_new'}?selectedRole=${encodedRole}&selectedCategory=${encodedDepartment}&selectedTask=${encodedTask}`;

            // Add language parameter if language is not English
            if (language && language.toLowerCase() !== 'english') {
                url += `&language=${encodeURIComponent(language)}`;
            }

            // Determine button color based on active state (for description button)
            const isButtonActive = activeButton === result.task && isTaskModalVisible;
            const buttonBackgroundColor = isButtonActive ? "#ffd700" : "#007bff";

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
                    {/* Enhanced Description Button */}
                    <button
                        onClick={(e) => handleDescriptionClick(e, result.task, result.role)}
                        style={{
                            padding: "0.25rem 0.5rem",
                            backgroundColor: buttonBackgroundColor,
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                            fontWeight: "bold",
                            marginLeft: "0.5rem",
                            transition: "background-color 0.2s ease"
                        }}
                        title="View task description"
                    >
                        D
                    </button>
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

        // Only include department if a specific one is selected
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
                // When "ALL" is selected, don't filter results - return all results
                let filteredResults = data.results || [];

                // No filtering when "ALL" is selected - show all results
                // Results will be linked appropriately based on department in formatResults

                // Process and display the results
                setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        role: 'user',
                        content: input.query,
                    },
                    {
                        role: 'assistant',
                        content: formatResults(filteredResults),
                    },
                ]);
            } else {
                // Handle error response
                setMessages((prevMessages) => [
                    ...prevMessages,
                    {
                        role: 'assistant',
                        content: data.error || <LocalizedText name="An error occurred while processing your request." />,
                    },
                ]);
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    role: 'assistant',
                    content: <LocalizedText name="An error occurred while processing your request." />,
                },
            ]);
        }

        // Reset the input field
        setInput({ query: '' });
    };

    // Fetch departments for the chat modal
    useEffect(() => {
        if (isOpen) {
            fetchChatDepartments();
        }
    }, [isOpen]);

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
                    // Filter out specific roles
                    const filteredRoles = roles.filter((role: string) =>
                        role !== "User Research Collector" &&
                        role !== "Favorite Task"
                    );
                    setChatRoles(['ALL', ...filteredRoles]);
                    setSelectedChatRole('ALL');
                } catch (error) {
                    console.error('Error fetching roles:', error);
                    toast.error(<LocalizedText name="Failed to fetch roles" />);
                }
            };

            fetchChatRoles();
        }
    }, [selectedChatDepartment]);

    // Close the modal when the Escape key is pressed
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isTaskModalVisible) {
                    setIsTaskModalVisible(false);
                    setActiveButton(null);
                } else {
                    onClose();
                }
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
    }, [isOpen, onClose, isTaskModalVisible]);

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

    // Update localized placeholder
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
            <div className={styles.modalContainer}>
                {/* Close Button */}
                <button className={styles.closeButton} onClick={onClose}>
                    &times;
                </button>

                {/* Header */}
                <h2 className={styles.modalTitle}>
                    <LocalizedText name="Business Chat" />
                </h2>

                {/* Department and Role Selectors */}
                <div className={styles.dropdownContainer}>
                    <select
                        value={selectedChatDepartment}
                        onChange={(e) => setSelectedChatDepartment(e.target.value)}
                        className={styles.chatDropdown}
                        aria-label="Select Department"
                    >
                        {chatDepartments.map((dept) => (
                            <option key={dept} value={dept}>
                                {dept === 'ALL' ? 'All Departments' : dept}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedChatRole}
                        onChange={(e) => setSelectedChatRole(e.target.value)}
                        className={styles.chatDropdown}
                        aria-label="Select Role"
                    >
                        {chatRoles.map((role) => (
                            <option key={role} value={role}>
                                {role === 'ALL' ? 'All Roles' : role}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Chat messages */}
                <div className={styles.messagesContainer}>
                    {messages.map((message: any, index: number) => (
                        <div key={index} className={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
                            {message.role === 'assistant' ? (
                                <div className={styles.assistantContent}>
                                    {message.content}
                                </div>
                            ) : (
                                <div className={styles.userContent}>
                                    {message.content}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Input form */}
                <form onSubmit={handleSubmit} className={styles.inputForm}>
                    <input
                        type="text"
                        value={input.query}
                        onChange={handleInputChange}
                        placeholder={localizedPlaceholder}
                        className={styles.inputField}
                        required
                    />
                    <button type="submit" className={styles.submitButton}>
                        <LocalizedText name="Send" />
                    </button>
                </form>

                {/* Task Description Modal */}
                {isTaskModalVisible && (
                    <div
                        className={styles.taskModal}
                        style={{
                            position: 'absolute',
                            top: modalPosition.top,
                            left: modalPosition.left,
                            zIndex: 1000,
                        }}
                        ref={modalRef}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.taskModalHeader}>
                            <span><LocalizedText name="Task Description" /></span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsTaskModalVisible(false);
                                    setActiveButton(null);
                                }}
                                className={styles.taskModalCloseButton}
                            >
                                ×
                            </button>
                        </div>
                        <div className={styles.taskModalContent}>
                            {taskDescription ? (
                                <div dangerouslySetInnerHTML={{ __html: taskDescription }} />
                            ) : (
                                <LocalizedText name="Loading..." />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessChatModal;
