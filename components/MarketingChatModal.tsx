// components/MarketingChatModal.tsx

import React, { useState, useEffect, ChangeEvent, useContext, useRef } from 'react';
import styles from '../styles/ChatModal.module.css';
import { toast } from 'react-toastify';
import { LocalizationContext } from '../util/LocalizationContext';
import { LocalizedText, getLocalizedString } from '../util/LocalizedText';

interface MarketingChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    externalVisibility?: boolean; // New prop for business context
}

const MarketingChatModal: React.FC<MarketingChatModalProps> = ({
    isOpen,
    onClose,
    externalVisibility
}) => {

    // Rest of component logic...


    const { language } = useContext(LocalizationContext);
    const [input, setInput] = useState<{ query: string }>({ query: '' });
    const [messages, setMessages] = useState<any[]>([]);
    // const [chatRoles, setChatRoles] = useState<string[]>(['ALL']);

    // States for task description modal
    const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
    const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
    const [taskDescription, setTaskDescription] = useState<string | null>(null);
    const [activeButton, setActiveButton] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const [chatDepartments, setChatDepartments] = useState<string[]>([]);
    const [chatRoles, setChatRoles] = useState<string[]>(['ALL']);
    const [selectedChatDepartment, setSelectedChatDepartment] = useState<string>('ALL');
    const [selectedChatRole, setSelectedChatRole] = useState<string>('ALL');
    const [localizedPlaceholder, setLocalizedPlaceholder] = useState("What is your primary objective for this task?");
    const [entrepreneurDepartments, setEntrepreneurDepartments] = useState<string[]>([]);
    const [nonEntrepreneurDepartments, setNonEntrepreneurDepartments] = useState<string[]>([]);
    // Removed: const FIXED_DEPARTMENT = "Vibe Marketing";


    // Handle input changes for chat input
    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setInput({ query: e.target.value });
    };

    // Function to handle task description click with enhanced button state management
    //const handleDescriptionClick = async (event: React.MouseEvent<HTMLButtonElement>, task: string, role?: string) => {
    // Fetch departments for the chat modal
    const fetchChatDepartments = async () => {
        try {
            const response = await fetch('/api/get-entrepreneur-group-departments');
            if (!response.ok) {
                throw new Error('Failed to fetch entrepreneur group departments');
            }
            const data = await response.json();
            const departments = Array.isArray(data.departments) ? data.departments : [];
            setChatDepartments(['ALL', ...departments]); // Include 'ALL' as default option
        } catch (error) {
            console.error('Error fetching entrepreneur group departments:', error);
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
            const departmentToUse = selectedChatDepartment !== 'ALL' ? selectedChatDepartment : 'Vibe Marketing';

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

    // Fetch entrepreneur departments
    const fetchEntrepreneurDepartments = async () => {
        try {
            const response = await fetch('/api/get-entrepreneur-group-departments');
            if (!response.ok) {
                throw new Error('Failed to fetch entrepreneur group departments');
            }
            const data = await response.json();
            const departments = Array.isArray(data.departments) ? data.departments : [];
            setEntrepreneurDepartments(departments);
            setChatDepartments(['ALL', ...departments]); // Include 'ALL' as default option
        } catch (error) {
            console.error('Error fetching entrepreneur group departments:', error);
            toast.error(<LocalizedText name="Failed to fetch departments" />);
        }
    };

    // Fetch non-entrepreneur departments
    const fetchNonEntrepreneurDepartments = async () => {
        try {
            const response = await fetch('/api/get-non-entrepreneur-group-departments');
            if (!response.ok) {
                throw new Error('Failed to fetch non-entrepreneur group departments');
            }
            const data = await response.json();
            const departments = Array.isArray(data.departments) ? data.departments : [];
            setNonEntrepreneurDepartments(departments);
            setChatDepartments(['ALL', ...departments]); // Include 'ALL' as default option
        } catch (error) {
            console.error('Error fetching non-entrepreneur group departments:', error);
            toast.error(<LocalizedText name="Failed to fetch departments" />);
        }
    };


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

            // Determine link based on department type
            const isEntrepreneurDepartment = entrepreneurDepartments.includes(result.department);
            const chatHomeRoute = isEntrepreneurDepartment ? 'ChatHome_new' : 'ChatHome_bus';

            let url = `${baseUrl}/${chatHomeRoute}?selectedRole=${encodedRole}&selectedCategory=${encodedDepartment}&selectedTask=${encodedTask}`;

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
                    {/* Keep the description button but move it to a new line */}
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
                // When "ALL" is selected, search against all departments but don't filter results
                let filteredResults = data.results || [];

                // No filtering when "ALL" is selected - show all results
                // The formatResults function will handle appropriate linking based on department type


                if (selectedChatDepartment === 'ALL') {
                    // Get the available entrepreneur group departments (excluding 'ALL')
                    const availableDepartments = chatDepartments.filter(dept => dept !== 'ALL');

                    // Filter results to only include these departments
                    //   filteredResults = filteredResults.filter((result: any) =>
                    //       result.department && availableDepartments.includes(result.department)
                    //   );
                }

                // Process and display the filtered results
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

    // Fetch all departments (entrepreneur + non-entrepreneur) for complete classification
    const fetchAllDepartmentsForClassification = async () => {
        try {
            // Fetch entrepreneur departments
            const entrepreneurResponse = await fetch('/api/get-entrepreneur-group-departments');
            let entrepreneurDepartments: string[] = [];

            if (entrepreneurResponse.ok) {
                const entrepreneurData = await entrepreneurResponse.json();
                entrepreneurDepartments = Array.isArray(entrepreneurData.departments) ? entrepreneurData.departments : [];
                setEntrepreneurDepartments(entrepreneurDepartments);
            }

            // Fetch non-entrepreneur departments
            const nonEntrepreneurResponse = await fetch('/api/get-non-entrepreneur-group-departments');
            let nonEntrepreneurDepartments: string[] = [];

            if (nonEntrepreneurResponse.ok) {
                const nonEntrepreneurData = await nonEntrepreneurResponse.json();
                nonEntrepreneurDepartments = Array.isArray(nonEntrepreneurData.departments) ? nonEntrepreneurData.departments : [];
                setNonEntrepreneurDepartments(nonEntrepreneurDepartments);
            }

            // Combine all departments for complete population coverage
            const allDepartments = [...entrepreneurDepartments, ...nonEntrepreneurDepartments];

            // Set the complete department list for "All" selection
            setChatDepartments(['ALL', ...allDepartments]);

            console.log('All departments fetched:', {
                entrepreneur: entrepreneurDepartments.length,
                nonEntrepreneur: nonEntrepreneurDepartments.length,
                total: allDepartments.length
            });

        } catch (error) {
            console.error('Error fetching all departments for classification:', error);
            toast.error(<LocalizedText name="Failed to fetch departments" />);
        }
    };

    // Call this when component mounts to always have complete department classification
    useEffect(() => {
        fetchAllDepartmentsForClassification();
    }, []);



    // Fetch departments based on isOpen flag
    useEffect(() => {
        if (isOpen) {
            fetchEntrepreneurDepartments();
        } else {
            fetchNonEntrepreneurDepartments();
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

    // For business context, we need to check if the modal should be visible
    // The business context will control visibility through its own state
    const isBusinessContext = !isOpen; // When isOpen is false, it's business context
    //const shouldShowModal = isBusinessContext ? isChatModalOpen : isOpen;

    // Determine if modal should be visible
    const shouldShowModal = externalVisibility !== undefined ? externalVisibility : isOpen;

    if (!shouldShowModal) return null;




    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                {/* Close Button */}
                <button className={styles.closeButton} onClick={onClose} aria-label="Close Modal">
                    &times;
                </button>

                {/* Header indicating this is for Vibe Marketing */}
                <div className={styles.modalHeader} style={{ textAlign: 'center' }}>
                    <h3 style={{ fontWeight: 'bold', color: 'black', margin: 0 }}>
                        <LocalizedText name="AI Task Search " />
                    </h3>
                </div>
                <p></p>

                {/* Role Selector - No Department selector since it's hardcoded */}
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, color: '#495057' }}><LocalizedText name={isOpen ? "Entrepreneur Group Chat" : "Business Group Chat"} /></h3>
                </div>

                {/* Department and Role Selectors */}
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
                    <select
                        value={selectedChatDepartment}
                        onChange={(e) => setSelectedChatDepartment(e.target.value)}
                        className={styles.chatDropdown}
                        aria-label="Select Department"
                    >
                        {chatDepartments.map((dept) => (
                            <option key={dept} value={dept}>
                                {dept === 'ALL' ? <LocalizedText name="All Departments" /> : dept}
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
                                {role === 'ALL' ? <LocalizedText name="All Roles" /> : role}
                            </option>
                        ))}
                    </select>
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

                {/* Task Description Modal */}
                {isTaskModalVisible && (
                    <div
                        ref={modalRef}
                        style={{
                            position: "fixed",
                            top: modalPosition.top,
                            left: modalPosition.left,
                            backgroundColor: "blue",
                            color: "white",
                            padding: "15px",
                            border: "1px solid #ccc",
                            borderRadius: "8px",
                            boxShadow: "2px 2px 5px darkred",
                            width: "400px",
                            zIndex: 10001,
                            maxHeight: "300px",
                            overflowY: "auto"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            style={{
                                position: "absolute",
                                top: "5px",
                                right: "5px",
                                background: "transparent",
                                border: "none",
                                fontSize: "16px",
                                cursor: "pointer",
                                color: "white"
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsTaskModalVisible(false);
                                setActiveButton(null);
                            }}
                        >
                            &times;
                        </button>
                        <h4 style={{ textAlign: "center", marginTop: "6px", marginBottom: "10px" }}>
                            <LocalizedText name="Task Description" />
                        </h4>
                        <p style={{ marginTop: "6px" }}>
                            {taskDescription ? (
                                taskDescription
                            ) : (
                                <LocalizedText name="Please wait, Still loading ...." />
                            )}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketingChatModal;
