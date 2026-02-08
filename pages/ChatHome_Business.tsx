/* eslint-disable react-hooks/exhaustive-deps */
import { useActiveAccount } from '../hooks/useWalletAddress';
import styles from "../styles/ChatHome1.module.css";
import Navbar from "../components/Navbar";
import { useState, useEffect, useRef, useCallback, useContext, ChangeEvent } from "react";
import SignIn from "../components/SignIn";
import RatingComponent from "../components/RatingComponent";
import Head from "next/head";
import { useSharedContext } from "../context/SharedContext";
import { useRouter } from "next/router";
import ChatBase from "../components/ChatBase";
import FileSearchKnowledgeBase from "../components/FileSearchKnowledgeBase";
import SourceSelector from "../components/SourceSelector";
import HashUtil from '../util/hashToFixedDigits';
import { LocalizedText, getLocalizedString } from "../util/LocalizedText";
import { LocalizationContext } from "../util/LocalizationContext";
import { usePayment } from "../hook/Payment_Process";
import { UPLOAD_FILE_FEE, PLATFORM_NAME } from "../constants/constants";
import { toast } from "react-toastify";
import TaskItem from "../components/TaskItem";
import RoleItem from "../components/RoleItem";
import axios from "axios";
import { debounce } from 'lodash'
import { eventBus, EVENT_TYPES, RoleEventData } from '../utils/eventBus';

import 'react-toastify/dist/ReactToastify.css';



// Define interfaces
interface RoleData {
    department: string;
    role: string;
}

interface LocalizedMessages {
    cleanupSuccess: string;
    cleanupFailed: string;
    cleanupError: string;
    translateFailed: string;
    uploadSuccess: string;
    uploadFailed: string;
}

// EmbeddingItem is the type returned by listEmbeddings endpoint.
interface EmbeddingItem {
    key: string;
    documentName?: string;
    owner: string;
    shared: string[];
    isOwner: boolean;
}

//
// ShareManager Component
// Renders a share button which toggles a dropdown list for the owner.
// The owner may add or remove shared user IDs using the new endpoints.
//

// Type for a user entry returned by the APIs.
interface IUser {
    userAddress: string;
    userName: string;
}

// Type for the embedding item passed from the parent.
interface EmbeddingItem {
    key: string;
    shared: string[]; // list of user addresses with whom the file is shared
    // add additional fields if needed
}

// Component props include the current userAddress, the embedding item,
// a callback to update the shared list, and a callback to close the modal.



interface ShareManagerProps {
    embedding: {
        key: string;
        shared: string[];
        isOwner: boolean;
    };
    currentUserName: string;
    currentUserAddress: string;
    onUpdateShare: (newShares: string[]) => void;
    onClose: () => void;
    style?: React.CSSProperties; // Add this line
}



const ShareManager: React.FC<ShareManagerProps> = ({
    embedding,
    currentUserAddress,
    currentUserName,
    onUpdateShare,
    onClose,
    style,
}) => {
    const [newShare, setNewShare] = useState("");
    const [sharedUsers, setSharedUsers] = useState<{ userAddress: string; userName: string }[]>([]);
    const [availableUsers, setAvailableUsers] = useState<{ userAddress: string; userName: string }[]>([]);
    const [selectedToRemove, setSelectedToRemove] = useState("");
    const [selectedToAdd, setSelectedToAdd] = useState("");

    // Fetch shared users from the updated endpoint.
    const fetchSharedUsers = async () => {
        try {
            const res = await axios.get(`/api/sharedUsers/get?sourceKey=${embedding.key}`);
            if (res.data && res.data.selectedSources) {
                setSharedUsers(res.data.selectedSources); // Ensure it's an array of { userAddress, userName }
                onUpdateShare(res.data.selectedSources);
            }
        } catch (error) {
            console.error("Error fetching shared users:", error);
        }
    };

    // Fetch all available users in the company
    const fetchAvailableUsers = async () => {
        try {
            const res = await axios.get(`/api/getCompanyUsers?userAddress=${currentUserAddress}`);
            if (res.data && res.data.users) {
                setAvailableUsers(res.data.users);
            }
        } catch (error) {
            console.error("Error fetching available company users:", error);
        }
    };

    useEffect(() => {
        fetchSharedUsers();
        fetchAvailableUsers();
    }, [currentUserName]);

    const handleAdd = async () => {
        if (!selectedToAdd) return;
        try {
            const res = await axios.post("/api/sharedUsers/add", {
                userAddress: selectedToAdd,
                sourceKey: embedding.key,
            });
            toast.success(res.data.message || "Added shared user successfully");
            await fetchSharedUsers();
            setSelectedToAdd("");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error adding shared user");
        }
    };

    const handleRemove = async () => {
        if (!selectedToRemove) return;
        try {
            const res = await axios.post("/api/sharedUsers/remove", {
                userAddress: selectedToRemove,
                sourceKey: embedding.key,
            });
            toast.success(res.data.message || "Removed shared user successfully");
            await fetchSharedUsers();
            setSelectedToRemove("");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error removing shared user");
        }
    };

    return (
        <div
            style={{
                position: "relative",
                top: "100%",
                right: 0,
                backgroundColor: "white",
                border: "1px solid #ccc",
                padding: "1rem",
                boxShadow: "0 0 10px rgba(0,0,0,0.2)",
                zIndex: 1000,
                minWidth: "250px",
            }}
        >
            {/* Header with close button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, color: "blue" }}>
                    <LocalizedText name="Share" />
                </h3>
                <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}>
                    X
                </button>
            </div>

            {/* Currently Shared Users Dropdown */}
            <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontWeight: "bold", color: "blue", display: "block", marginBottom: "0.5rem" }}>
                    <LocalizedText name="Currently Shared Users" />:
                </label>
                <select
                    value={selectedToRemove}
                    onChange={(e) => setSelectedToRemove(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        marginBottom: "0.5rem"
                    }}
                >
                    <option value="">{<LocalizedText name="Select a user to remove" />}</option>
                    {sharedUsers.map((user) => (
                        <option key={user.userAddress} value={user.userAddress}>
                            {user.userName}
                        </option>
                    ))}
                </select>
                <button onClick={handleRemove} disabled={!selectedToRemove} style={{ padding: "0.5rem 1rem", backgroundColor: "red", color: "white" }}>
                    <LocalizedText name="Remove" />
                </button>
            </div>

            {/* Add User to Share Dropdown */}
            <div>
                <label style={{ fontWeight: "bold", color: "blue", display: "block", marginBottom: "0.5rem" }}>
                    <LocalizedText name="Add User to Share" />:
                </label>
                <select
                    value={selectedToAdd}
                    onChange={(e) => setSelectedToAdd(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                        marginBottom: "0.5rem",
                    }}
                >
                    <option value="">{<LocalizedText name="Select a user to add" />}</option>
                    {availableUsers
                        .filter((user) => !sharedUsers.some((shared) => shared.userAddress === user.userAddress))
                        .map((user) => (
                            <option key={user.userAddress} value={user.userAddress}>
                                {user.userName}
                            </option>
                        ))}
                </select>
                <button
                    onClick={handleAdd}
                    disabled={!selectedToAdd}
                    style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "green",
                        color: "white",
                        border: "none",
                        width: "100%",
                        cursor: "pointer",
                    }}
                >
                    <LocalizedText name="Add" />
                </button>
            </div>

        </div>
    );
};



//
// ChatHome Component
//
interface ChatHomeBusinessProps {
    parentSelectedRole?: string;
    onRoleChange?: (role: string) => void;
    isShopExpanded?: boolean;
    onDropdownRoleSelect?: (role: any) => void;
}

const ChatHome: React.FC<ChatHomeBusinessProps> = ({
    parentSelectedRole,
    onRoleChange,
    isShopExpanded,
    onDropdownRoleSelect,
    // existing props
}) => {
    const { language, setLanguage } = useContext(LocalizationContext);
    const { account, isLoading: isAccountLoading, error } = useActiveAccount();
    const address = account?.address;
    const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
    const [roles, setRoles] = useState<RoleData[]>([]);
    const [tasks, setTasks] = useState<string[]>([]);
    const [selectedTask, setSelectedTask] = useState<string | null>(null);
    const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
    const [scrapeStatus, setScrapeStatus] = useState<string>("");
    const [scrapeStatuses, setScrapeStatuses] = useState<{ url: string; scrapedAt: string }[]>([]);

    const { freeChatsLeft, setFreeChatsLeft, freeUploadsLeft, setFreeUploadsLeft, freeWebScrapeLeft, setFreeWebScrapeLeft } = useSharedContext();

    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState("");
    // isModalOpen controls the file-upload modal visibility
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter();
    const roleButtonRef = useRef<HTMLDivElement>(null);
    const taskButtonRef = useRef<HTMLDivElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
    const [isTaskDropdownOpen, setIsTaskDropdownOpen] = useState(false);
    const [textInput, setTextInput] = useState("");
    // Language dropdown is removed from the modal; we use the stored language.
    const [selectedLanguage, setSelectedLanguage] = useState<string>("English");
    const [languages, setLanguages] = useState<string[]>([]);
    const [taskDescription, setTaskDescription] = useState<string | null>(null);
    const [hoveredTask, setHoveredTask] = useState<string | null>(null);
    const { process_payment, isPaymentProcessing } = usePayment();
    const [isTaskModalVisible, setIsTaskModalVisible] = useState(false);
    const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 });
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const [activeButton, setActiveButton] = useState<string | null>(null);
    const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);
    const [roleModalPosition, setRoleModalPosition] = useState({ top: 0, left: 0 });
    const [roleDescription, setRoleDescription] = useState<string | null>(null);
    const [activeRoleButton, setActiveRoleButton] = useState<string | null>(null);
    const hasAddedFavoriteFromURL = useRef(false);
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
    const [isFavoriteTasksLoaded, setIsFavoriteTasksLoaded] = useState<boolean>(false);
    const [isChatRunning, setIsChatRunning] = useState(false);
    const [favoriteTasks, setFavoriteTasks] = useState<string[]>([]);
    const [isRunButtonDisabled, setIsRunButtonDisabled] = useState(false);
    const [isRunButtonHovered, setIsRunButtonHovered] = useState(false);
    const [showShareManager, setShowShareManager] = useState(false);
    const [openShareManagerKey, setOpenShareManagerKey] = useState<string | null>(null);
    // At the top of your ChatHome.tsx component (or in the state definitions section):
    const [openShareKey, setOpenShareKey] = useState<string | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [isUploadButtonDisabled, setIsUploadButtonDisabled] = useState(false);
    const [uploadStatusMessage, setUploadStatusMessage] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>('Favorite');

    // NEW: Define availableEmbeddings (using our EmbeddingItem interface)
    const [availableEmbeddings, setAvailableEmbeddings] = useState<EmbeddingItem[]>([]);
    // Selected embeddings (by key) that the user wants to include in the Q&A context.
    const [selectedEmbeddings, setSelectedEmbeddings] = useState<string[]>([]);

    // New state for file upload: upload name
    const [uploadName, setUploadName] = useState<string>("");

    // Check for upload name uniqueness before uploading.
    const checkUploadNameExists = async (name: string): Promise<boolean> => {
        try {
            const res = await fetch(`/api/checkUploadName?name=${encodeURIComponent(name)}&userAddress=${address}`);
            if (res.ok) {
                const data = await res.json();
                return data.exists;
            }
            return false;
        } catch (error) {
            console.error("Error checking upload name:", error);
            return false;
        }
    };
    // ============================
    // NEW STATE AND HELPER FUNCTIONS (add near your other useState hooks)
    // ============================
    const [userSelectedSources, setUserSelectedSources] = useState<string[]>([]);

    // Knowledge Base source selection for Q&A
    const [kbSelectedSources, setKbSelectedSources] = useState<string[]>([]);

    const fetchUserSelectedSources = async () => {
        if (!address) return;
        try {
            const res = await fetch(`/api/selectedSources/get?userAddress=${address}`);
            if (res.ok) {
                const data = await res.json();
                console.log("[fetchUserSelectedSources] Retrieved:", data.selectedSources);
                setUserSelectedSources(data.selectedSources || []);
            }
        } catch (error) {
            console.error("Error fetching selected sources:", error);
        }
    };

    const handleAddSource = async (sourceKey: string) => {
        if (!address) return;
        try {
            const res = await fetch("/api/selectedSources/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userAddress: address, sourceKey }),
            });
            if (res.ok) {
                const data = await res.json();
                console.log("[handleAddSource] Updated selected sources:", data.selectedSources);
                setUserSelectedSources(data.selectedSources);
            }
        } catch (error) {
            console.error("Error adding source:", error);
        }
    };

    const handleRemoveSource = async (sourceKey: string) => {
        if (!address) return;
        try {
            const res = await fetch("/api/selectedSources/remove", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userAddress: address, sourceKey }),
            });
            if (res.ok) {
                const data = await res.json();
                console.log("[handleRemoveSource] Updated selected sources:", data.selectedSources);
                setUserSelectedSources(data.selectedSources);
            }
        } catch (error) {
            console.error("Error removing source:", error);
        }
    };

    // Sync with parent selected role
    useEffect(() => {
        if (parentSelectedRole && parentSelectedRole !== selectedRole?.role) {

            setSelectedRole({
                role: parentSelectedRole,
                department: selectedCategory || 'Favorite'
            });

            // Fetch role description if needed
            if (parentSelectedRole) {
                fetchRoleDescription(selectedCategory || 'Favorite', parentSelectedRole);

            }
        }
    }, [parentSelectedRole]);

    // Notify parent of role changes
    useEffect(() => {
        if (selectedRole && onRoleChange) {
            onRoleChange(selectedRole?.role || '');

        }
    }, [selectedRole, onRoleChange]);

    // Handle shop expansion state
    useEffect(() => {
        if (isShopExpanded !== undefined) {
            console.log('Shop expanded state:', isShopExpanded);
            // Note: Removed empty EXPAND_PANE_UPDATE emission that was causing errors
        }
    }, [isShopExpanded]);



    // Fetch the selected sources when the modal opens:
    useEffect(() => {
        if (isModalOpen && address) {
            fetchUserSelectedSources();
        }
    }, [isModalOpen, address]);

    useEffect(() => {
        if (parentSelectedRole && parentSelectedRole !== selectedRole?.role) {
            setSelectedRole({
                role: parentSelectedRole,
                department: selectedCategory || 'Favorite'
            });

            // Fetch role description with proper arguments
            if (parentSelectedRole) {
                fetchRoleDescription(selectedCategory || 'Favorite', parentSelectedRole);
            }
        }
    }, [parentSelectedRole, selectedCategory]);

    const handleRoleSelection = (role: string) => {
        setSelectedRole({
            role: role,
            department: selectedCategory || 'Favorite'
        });

        // Sync with parent selected role

        if (onRoleChange) {
            onRoleChange(role);
        }

        // existing logic...
    };

    const handleDropdownSelection = (role: any) => {
        if (onDropdownRoleSelect) {
            onDropdownRoleSelect(role);
        }
        handleRoleSelection(role.role || role);
    };


    const handleDescriptionMouseEnter = () => {
        setIsTooltipVisible(true);
    };

    const handleDescriptionMouseLeave = () => {
        setIsTooltipVisible(false);
    };

    // Fetch and set user perks
    const fetchUserPerks = useCallback(async () => {
        if (!address) return;
        try {
            const response = await fetch(`/api/get-user-perks?userAddress=${encodeURIComponent(address)}`);
            if (response.ok) {
                const data = await response.json();
                setFreeChatsLeft(data.freeTrades);
                setFreeUploadsLeft(data.freeUploads);
                setFreeWebScrapeLeft(data.freeWebScrape);
            } else {
                const errorData = await response.json();
                toast.error(errorData.message || "Failed to retrieve perks.");
            }
        } catch (error) {
            console.error("Error fetching user perks:", error);
            toast.error("An unexpected error occurred while fetching perks.");
        }
    }, [address]);

    // Fetch available embeddings from the backend
    useEffect(() => {
        if (isModalOpen && address) {
            fetch(`/api/listEmbeddings?userAddress=${address}`)
                .then((res) => res.json())
                .then((data) => {
                    // data.embeddings is expected to be an array of EmbeddingItem objects
                    setAvailableEmbeddings(data.embeddings || []);
                })
                .catch((error) => console.error("Error fetching embeddings list:", error));
        }
    }, [isModalOpen, address]);



    // Fetch the user's current selected sources from the new API endpoint.
    useEffect(() => {
        if (isModalOpen && address) {
            fetch(`/api/selectedSources/get?userAddress=${address}`)
                .then((res) => res.json())
                .then((data) => {
                    setSelectedEmbeddings(data.selectedSources || []);
                })
                .catch((err) => console.error("Error fetching selected sources:", err));
        }
    }, [isModalOpen, address]);

    // Handle changes to the embedding checkbox by calling the add/remove endpoints.
    const handleEmbeddingCheckboxChange = async (embeddingKey: string, checked: boolean) => {
        if (!address) return;
        try {
            if (checked) {
                const res = await fetch("/api/selectedSources/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userAddress: address, sourceKey: embeddingKey }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setSelectedEmbeddings(data.selectedSources);
                } else {
                    toast.error("Failed to add selected embedding");
                }
            } else {
                const res = await fetch("/api/selectedSources/remove", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userAddress: address, sourceKey: embeddingKey }),
                });
                if (res.ok) {
                    const data = await res.json();
                    setSelectedEmbeddings(data.selectedSources);
                } else {
                    toast.error("Failed to remove selected embedding");
                }
            }
        } catch (error) {
            console.error("Error updating selected embedding:", error);
        }
    };

    const handleEmbeddingSelection = async (embeddingId: string) => {
        const updatedSelectedEmbeddings = selectedEmbeddings.includes(embeddingId)
            ? selectedEmbeddings.filter((id) => id !== embeddingId) // Deselect
            : [...selectedEmbeddings, embeddingId]; // Select

        setSelectedEmbeddings(updatedSelectedEmbeddings);

        // Persist changes via API
        try {
            await fetch('/api/update-selected-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: address, selectedSources: updatedSelectedEmbeddings }),
            });
            console.log('Embedding selection updated successfully.');
        } catch (error) {
            console.error('Failed to update embedding selection:', error);
        }
    };


    // (Optional) Update scrapeStatuses if needed
    useEffect(() => {
        if (isModalOpen && address) {
            fetch(`/api/get-scrape-status?userAddress=${address}`)
                .then((res) => res.json())
                .then((data) => {
                    setScrapeStatuses(data);
                })
                .catch((error) => {
                    console.error("Error fetching scrape statuses:", error);
                });
        }
    }, [isModalOpen, address]);

    useEffect(() => {
        if (address) {
            fetchUserPerks();
        } else {
            setFreeChatsLeft(null);
            setFreeUploadsLeft(null);
            setFreeWebScrapeLeft(null);
        }
    }, [address, fetchUserPerks]);

    const addFavorite = useCallback(
        async (task: string) => {
            if (!address || !selectedRole) return;
            if (favoriteTasks.includes(task)) return;
            try {
                const response = await fetch("/api/add-task-favorite", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userAddress: address,
                        department: selectedRole.department,
                        role: selectedRole.role,
                        task: task,
                    }),
                });
                if (!response.ok) throw new Error("Failed to add favorite task");
                setFavoriteTasks((prev) => [...prev, task]);
                toast.info(<LocalizedText name={`Task ${task} Favorited`} />, {
                    style: { backgroundColor: "#4CAF50", color: "#fff" },
                });
            } catch (error) {
                console.error("Error adding favorite task:", error);
                toast.error(<LocalizedText name="Failed To Update Favorite" />);
            }
        },
        [address, selectedRole, favoriteTasks]
    );

    const fetchFavoriteTasks = async () => {
        if (!address || !selectedRole) return;
        try {
            const response = await fetch("/api/get-task-favorites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userAddress: address,
                    department: selectedRole.department,
                    role: selectedRole.role,
                }),
            });
            if (!response.ok) throw new Error("Failed to fetch favorite tasks");
            const data = await response.json();
            setFavoriteTasks(data.favoriteTasks || []);
        } catch (error) {
            console.error("Error fetching favorite tasks:", error);
        } finally {
            setIsFavoriteTasksLoaded(true);
        }
    };

    useEffect(() => {
        fetchFavoriteTasks();
    }, [selectedRole, address]);

    const toggleFavorite = useCallback(
        async (task: string) => {
            if (!address || !selectedRole) return;
            const isFavorited = favoriteTasks.includes(task);
            const endpoint = isFavorited ? "/api/remove-task-favorite" : "/api/add-task-favorite";
            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userAddress: address,
                        department: selectedRole.department,
                        role: selectedRole.role,
                        task: task,
                    }),
                });
                if (!response.ok) throw new Error("Failed to update favorite task");
                if (isFavorited) {
                    setFavoriteTasks((prev) => prev.filter((t) => t !== task));
                } else {
                    setFavoriteTasks((prev) => [...prev, task]);
                }
                toast.info(
                    !isFavorited ? (
                        <LocalizedText name={`Task ${task} Favorited`} />
                    ) : (
                        <LocalizedText name={`Task ${task} Unfavorited`} />
                    ),
                    { style: { backgroundColor: !isFavorited ? "#4CAF50" : "#F44336", color: "#fff" } }
                );
            } catch (error) {
                console.error("Error updating favorite task:", error);
                toast.error(<LocalizedText name="Failed To Update Favorite" />);
            }
        },
        [address, selectedRole, favoriteTasks]
    );

    const handleTaskChange = (task: string) => {
        setSelectedTask(task);
        setIsTaskDropdownOpen(false);
        setIsTaskModalVisible(false);
        setIsRoleModalVisible(false);
        setIsChatRunning(false);
        setIsRunButtonDisabled(false);
    };

    const handleDescriptionClick = async (event: React.MouseEvent<HTMLButtonElement>, task: string) => {
        event.stopPropagation();
        setIsRoleModalVisible(false);
        setTaskDescription(null);
        setActiveButton(task);
        const targetElement = event.currentTarget;
        if (!targetElement) {
            console.error("event.currentTarget is null");
            return;
        }
        const rect = targetElement.getBoundingClientRect();
        //  setModalPosition({ top: rect.top + window.scrollY, left: rect.right + 10 + window.scrollX });
        setModalPosition({
            top: rect.top + (typeof window !== 'undefined' ? window.scrollY : 0),
            left: rect.right + 10 + (typeof window !== 'undefined' ? window.scrollX : 0)
        });
        setIsTaskModalVisible(true);
        if (!selectedRole) {
            console.error("selectedRole is null");
            return;
        }
        if (taskDescription && activeButton === task) return;
        try {
            const response = await fetch("/api/get_task_description", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    department: selectedRole.department,
                    role: selectedRole.role,
                    task,
                    language: selectedLanguage,
                }),
            });
            if (!response.ok) throw new Error("Failed to fetch task description");
            const data = await response.json();
            setTaskDescription(data.description);
        } catch (error) {
            console.error("Error fetching task description:", error);
            setTaskDescription("");
        }
    };

    const handleRoleDescriptionClick = async (event: React.MouseEvent<HTMLButtonElement>, roleData: { department: string; role: string }) => {
        event.stopPropagation();
        setRoleDescription(null);
        const { department, role } = roleData;
        const uniqueKey = `${department}:${role}`;
        setActiveRoleButton(uniqueKey);
        const targetElement = event.currentTarget;
        if (!targetElement) {
            console.error("event.currentTarget is null");
            return;
        }
        const rect = targetElement.getBoundingClientRect();
        setRoleModalPosition({ top: rect.top - 100 + window.scrollY, left: rect.left - 465 + window.scrollX });
        setIsRoleModalVisible(true);
        try {
            const response = await fetch("/api/get_role_description", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ department, role, language: selectedLanguage }),
            });
            if (!response.ok) throw new Error("Failed to fetch role description");
            const data = await response.json();
            setRoleDescription(data.description);
        } catch (error) {
            console.error("Error fetching role description:", error);
            setRoleDescription("");
        }
    };

    const toggleTaskDropdown = () => {
        if (isTaskDropdownOpen) {
            handleCloseDropdown();
        } else {
            setIsTaskDropdownOpen(true);
        }
        setIsRoleDropdownOpen(false);
    };

    const toggleRoleDropdown = () => {
        setIsRoleDropdownOpen(!isRoleDropdownOpen);
        setIsTaskDropdownOpen(false);
    };

    const handleCloseModal = () => {
        setIsTaskDropdownOpen(false);
        setIsRoleDropdownOpen(false);
    };

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (
            taskButtonRef.current &&
            !taskButtonRef.current.contains(event.target as Node) &&
            modalRef.current &&
            !modalRef.current.contains(event.target as Node)
        ) {
            handleCloseDropdown();
        }
    }, []);

    const handleCloseDropdown = () => {
        setIsTaskDropdownOpen(false);
        setIsTaskModalVisible(false);
        setActiveButton(null);
        setActiveRoleButton(null);
        setIsRoleModalVisible(false);
    };

    const initializeContent = async () => {
        const fetchLanguages = async () => {
            try {
                const response = await fetch("/api/get_all_languages");
                if (response.ok) {
                    const langs: string[] = await response.json();
                    setLanguages(Array.from(new Set(langs)));
                }
            } catch (error) {
                console.error("Error fetching languages:", error);
            }
        };

        const fetchUserLanguage = async () => {
            if (address) {
                try {
                    const response = await fetch(`/api/get_user_language?userAddress=${address}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.language) {
                            setSelectedLanguage(data.language);
                            setLanguage(data.language);
                        } else {
                            setSelectedLanguage("English");
                            setLanguage("English");
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch user language:", error);
                    setSelectedLanguage("English");
                }
            }
        };

        await fetchLanguages();
        await fetchUserLanguage();
    };

    useEffect(() => {
        initializeContent();
    }, [address]);

    useEffect(() => {
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [handleClickOutside]);

    useEffect(() => {
        if (address) {
            fetchRoles();
        }
        fetchAvailableLanguages();
    }, [address]);

    useEffect(() => {
        const fetchTaskDescription = async (task: string, retries = 3) => {
            try {
                const response = await fetch("/api/get_task_description", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        department: selectedRole?.department,
                        role: selectedRole?.role,
                        task,
                        language: selectedLanguage,
                    }),
                });
                if (!response.ok) throw new Error("Failed to fetch task description");
                const data = await response.json();
                setTaskDescription(data.description);
            } catch (error) {
                console.error("Error fetching task description:", error);
                if (retries > 0) {
                    setTimeout(() => fetchTaskDescription(task, retries - 1), 1000);
                } else {
                    setTaskDescription("Error fetching .");
                }
            }
        };

        if (isTaskModalVisible && activeButton && !taskDescription) {
            fetchTaskDescription(activeButton);
        }
    }, [isTaskModalVisible, activeButton, selectedRole, selectedLanguage, taskDescription]);

    useEffect(() => {
        const initializeData = async () => {
            if (router.query.selectedRole && router.query.selectedCategory) {
                const selectedRoleData: RoleData = {
                    role: router.query.selectedRole as string,
                    department: router.query.selectedCategory as string,
                };
                setSelectedRole(selectedRoleData);
                await fetchTasks(selectedRoleData.department, selectedRoleData.role);
                if (router.query.selectedTask) {
                    setSelectedTask(router.query.selectedTask as string);
                    try {
                        const response = await fetch("/api/add-role-mapping", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                userAddress: address,
                                department: selectedRoleData.department,
                                role: selectedRoleData.role,
                            }),
                        });
                        if (!response.ok) {
                            throw new Error("Failed to add role mapping");
                        }
                        if (router.query.language && typeof router.query.language === "string") {
                            const languageFromURL = router.query.language;
                            setSelectedLanguage(languageFromURL);
                            setLanguage(languageFromURL);
                        }
                    } catch (error) {
                        console.error(`Error adding role mapping:`, error);
                    }
                    setIsChatRunning(false);
                } else {
                    setSelectedTask(null);
                }
            }
            if (router.query.language && typeof router.query.language === "string") {
                const languageFromURL = router.query.language;
                setSelectedLanguage(languageFromURL);
                setLanguage(languageFromURL);
            }
        };
        initializeData();
    }, [router.query]);

    // Add this useEffect to fetch tasks when role changes
    useEffect(() => {
        if (selectedRole && selectedRole.role && selectedRole.department) {
            console.log('Role changed, fetching tasks for:', selectedRole);
            fetchTasks(selectedRole.department, selectedRole.role);
            // Also clear the selected task when role changes
            setSelectedTask(null);
        }
    }, [selectedRole]);


    const fetchRoles = async () => {
        try {
            const response = await fetch("/api/get-role-by-address", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ address }),
            });
            if (!response.ok) throw new Error("Failed to fetch roles");
            const rolesData = await response.json();
            setRoles(rolesData);
        } catch (error) {
            console.error("Error fetching roles:", error);
        }
    };

    const fetchTasks = async (department: string, role: string): Promise<void> => {
        try {
            const response = await fetch("/api/get-tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ department, role }),
            });
            if (!response.ok) throw new Error("Failed to fetch tasks");
            const tasksData = await response.json();
            setTasks(tasksData.tasks);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    };

    const fetchAvailableLanguages = async () => {
        try {
            const response = await fetch("/api/get_all_languages");
            if (!response.ok) throw new Error("Failed to fetch languages");
            const langs = await response.json();
            //setAvailableLanguages(langs);
        } catch (error) {
            console.error("Error fetching languages:", error);
        }
    };



    useEffect(() => {
        if (selectedRole && selectedRole.role && selectedRole.department) {
            fetchRoleDescription(selectedRole.department, selectedRole.role);
        }
    }, [selectedRole]);

    const fetchRoleDescription = async (department: string, role: string) => {
        try {
            const response = await fetch(`/api/role-description?department=${department}&role=${role}`);
            if (response.ok) {
                const data = await response.json();
                setRoleDescription(data.description);
            } else {
                setRoleDescription("The persona description is currently unavailable. Please try again later");
            }
        } catch (error) {
            console.error("Error fetching role description:", error);
            setRoleDescription("Error fetching persona description");
        }
    };

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseFileModal = () => setIsModalOpen(false);

    // â”€â”€â”€ Define handleUpload for file upload modal â”€â”€â”€â”€â”€
    const handleUpload = async () => {
        setIsLoading(true);
        try {
            if (!address) {
                toast.info(await getLocalizedString("Please connect your wallet.", selectedLanguage));
                return;
            }
            if (!uploadName.trim()) {
                toast.info(await getLocalizedString("Please input the upload name.", selectedLanguage));
                return;
            }
            // Check if the upload name already exists.
            const nameExists = await checkUploadNameExists(uploadName.trim());
            if (nameExists) {
                if (typeof window !== 'undefined') {
                    const overwrite = window.confirm("This upload name already exists. Do you want to overwrite it?");
                    if (!overwrite) {
                        toast.info("Please choose a different upload name.");
                        setIsLoading(false);
                        return;
                    }
                }
            }
            if (!textInput.trim()) {
                toast.info(await getLocalizedString("Please input the content.", selectedLanguage));
                return;
            }
            const uploadFee = UPLOAD_FILE_FEE;
            const paymentSuccessful = await process_payment(address, 1, PLATFORM_NAME);
            if (!paymentSuccessful) {
                toast.error(await getLocalizedString("Insufficient balance or payment failed. Please try again.", selectedLanguage));
                return;
            }
            let finalText = textInput;
            // Always translate to English if needed.
            if (selectedLanguage.toLowerCase() !== "english") {
                try {
                    const response = await fetch("/api/translate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: uploadName,
                            description: textInput,
                            fromLanguage: selectedLanguage,
                            toLanguage: "English",
                        }),
                    });
                    if (!response.ok) throw new Error("Translation failed");
                    const result = await response.json();
                    finalText = result.translatedText;
                } catch (error) {
                    console.error("Error translating text:", error);
                }
            }
            // Call /api/uploadFile with the upload name, text, etc.
            const response = await fetch("/api/uploadFile", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Address": address,
                },
                body: JSON.stringify({
                    name: uploadName.trim(),
                    text: finalText,
                    sharedUserIds: [], // The backend will add the owner's ID automatically.
                }),
            });
            if (!response.ok) {
                throw new Error("Failed to upload text");
            }
            toast.success(await getLocalizedString("Text uploaded successfully", selectedLanguage));
            // Reset upload fields
            setUploadName("");
            setTextInput("");
            handleCloseFileModal();
        } catch (error) {
            console.error("Error uploading text:", error);
            toast.error(await getLocalizedString("Error uploading text. Please try again.", selectedLanguage));
        } finally {
            setIsLoading(false);
        }
    };

    // Local state for loading and placeholder text
    const [isLoading, setIsLoading] = useState(false);
    const [localizedPlaceholder, setLocalizedPlaceholder] = useState("Type or paste your text here...");

    useEffect(() => {
        const updatePlaceholder = async () => {
            const placeholderText = await getLocalizedString("Type or paste your text here...", selectedLanguage);
            setLocalizedPlaceholder(placeholderText);
        };
        updatePlaceholder();
    }, [selectedLanguage]);

    const [localizedPlaceholder_name, setLocalizedPlaceholder_name] = useState("Please enter a unique upload name using only English characters");

    useEffect(() => {
        const updatePlaceholder1 = async () => {
            const placeholderText = await getLocalizedString("Please enter a unique upload name using only English characters", selectedLanguage);
            setLocalizedPlaceholder_name(placeholderText);
        };
        updatePlaceholder1();
    }, [selectedLanguage]);

    const [localizedMessages, setLocalizedMessages] = useState<LocalizedMessages>({
        cleanupSuccess: "Embedding segment cleaned up successfully",
        cleanupFailed: "Embedding segment not found or already clean up",
        cleanupError: "Error occurred while cleaning up embedding segment",
        translateFailed: "Failed to translate text. Uploading original text.",
        uploadSuccess: "Text uploaded successfully",
        uploadFailed: "Failed to upload text. Please try again.",
    });

    useEffect(() => {
        const updateLocalizedMessages = async () => {
            const updatedMessages: Partial<LocalizedMessages> = {};
            for (const [key, message] of Object.entries(localizedMessages)) {
                updatedMessages[key as keyof LocalizedMessages] = await getLocalizedString(message, selectedLanguage);
            }
            setLocalizedMessages((prevMessages) => ({
                ...prevMessages,
                ...updatedMessages,
            }));
        };
        updateLocalizedMessages();
    }, [selectedLanguage]);

    useEffect(() => {
        const addFavoriteFromURL = async () => {
            if (
                selectedTask &&
                selectedRole &&
                isFavoriteTasksLoaded &&
                !hasAddedFavoriteFromURL.current &&
                !favoriteTasks.includes(selectedTask)
            ) {
                await addFavorite(selectedTask);
                hasAddedFavoriteFromURL.current = true;
            }
        };
        addFavoriteFromURL();
    }, [selectedTask, selectedRole, addFavorite, isFavoriteTasksLoaded]);

    const [siteUrl, setSiteUrl] = useState("");


    const refreshEmbeddings = async () => {
        try {
            const headers = new Headers();
            headers.append('Content-Type', 'application/json');
            if (address) headers.append('accountID', address);

            const response = await fetch('/api/get-user-embeddings', {
                method: 'GET',
                headers: headers
            });

            if (response.ok) {
                const data = await response.json();
                setEmbeddings(data.embeddings);
            }
        } catch (error) {
            console.error('Error refreshing embeddings:', error);
        }
    };


    const [embeddingsRefreshTime, setEmbeddingsRefreshTime] = useState(Date.now());


    const handleLoadData = async () => {
        setIsLoading(true);
        setScrapeStatus("Scraping in progress...");
        setIsUploadButtonDisabled(true); // Disable the button immediately
        setUploadStatusMessage("Uploading..."); // Change button text

        // Configure toast to appear above modal with high z-index
        toast.info(await getLocalizedString("Scraping in progress...", language), {
            position: "top-right",
            autoClose: 5000,
            closeOnClick: true,
            pauseOnHover: true,
            style: { zIndex: 9999 }, // Very high z-index to ensure it appears above modal
        });

        try {
            if (!address) {
                toast.info(await getLocalizedString("Please connect your wallet.", language), {
                    style: { zIndex: 9999 }
                });
                setIsLoading(false);
                setIsUploadButtonDisabled(false);
                setUploadStatusMessage(""); // Reset button text
                return;
            }

            if (!siteUrl.trim()) {
                toast.info(await getLocalizedString("Please enter a valid website URL.", language), {
                    style: { zIndex: 9999 }
                });
                setIsLoading(false);
                setIsUploadButtonDisabled(false);
                setUploadStatusMessage(""); // Reset button text
                return;
            }

            // Process payment first
            const paymentSuccessful = await process_payment(address, 1, PLATFORM_NAME);
            if (!paymentSuccessful) {
                toast.error(await getLocalizedString("Insufficient balance or payment failed. Please try again.", language), {
                    style: { zIndex: 9999 }
                });
                setIsLoading(false);
                setIsUploadButtonDisabled(false);
                setUploadStatusMessage(""); // Reset button text
                return;
            }

            try {
                // Call the API to initiate scraping with webhook
                const response = await fetch("/api/initiate-scrape", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "accountid": address,
                    },
                    body: JSON.stringify({
                        url: siteUrl,
                        sharedUserIds: [], // Optional: Add users to share access with
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || "Failed to initiate website scraping");
                }

                const data = await response.json();
                const scrapeTime = new Date().toLocaleString();

                // Clear input field after successful submission
                setSiteUrl("");

                // Update UI to show job is in progress
                setScrapeStatus(`Scraping of ${siteUrl} initiated at ${scrapeTime}. This process will continue in the background.`);
                toast.success(await getLocalizedString(`Scrape job started successfully. You'll be notified when it completes.`, language), {
                    style: { zIndex: 9999 }
                });

                // Set up polling to check status
                const statusCheckInterval = 20000; // Every 20 seconds
                let checkCount = 0;
                const maxChecks = 60; // Allow more checks for the multi-stage process

                const statusCheckId = setInterval(async () => {
                    try {
                        const statusResponse = await fetch(`/api/scrape-status?jobId=${data.jobId}`, {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json",
                                "accountid": address,
                            }
                        });

                        if (statusResponse.ok) {
                            const statusData = await statusResponse.json();

                            // Map status to user-friendly messages
                            let statusMessage = `Scraping of ${siteUrl} is in progress`;

                            if (statusData.status === 'CRAWLING') {
                                statusMessage = `Crawling ${siteUrl} sitemap to discover pages...`;
                            } else if (statusData.status === 'CRAWLING_FALLBACK') {
                                statusMessage = `Sitemap not found. Crawling ${siteUrl} directly...`;
                            } else if (statusData.status === 'PROCESSING') {
                                statusMessage = `Found ${statusData.pageCount || 'multiple'} pages. Creating embeddings...`;
                            }

                            // Update UI based on status
                            if (statusData.status === "SUCCEEDED") {
                                clearInterval(statusCheckId);
                                const pageText = statusData.pageCount ?
                                    `Processed ${statusData.pageCount} pages from` :
                                    'Successfully processed';

                                setScrapeStatus(`${pageText} ${siteUrl}. Content is now ready to use.`);
                                toast.success(await getLocalizedString("Web scraping completed successfully!", language), {
                                    style: { zIndex: 9999 }
                                });

                                // Re-enable the button when scraping is complete
                                setIsUploadButtonDisabled(false);
                                setUploadStatusMessage("");

                                // Add visual indicator that refresh is happening
                                setScrapeStatus(prev => `${prev} Refreshing content display...`);

                                // Add a slight delay to ensure server has indexed content
                                setTimeout(async () => {
                                    try {
                                        // Refresh embeddings with explicit await, but keep modal open
                                        if (typeof refreshEmbeddings === 'function') {
                                            await refreshEmbeddings();

                                            // Update status message to indicate refresh is complete
                                            setScrapeStatus(`${pageText} ${siteUrl}. Content refreshed and ready to use.`);

                                            // Force a re-render if needed
                                            setEmbeddingsRefreshTime?.(Date.now());
                                        }
                                    } catch (error) {
                                        console.error("Failed to refresh embeddings:", error);
                                        setScrapeStatus(prev => `${prev} Error refreshing display. Please try again.`);
                                        toast.error(await getLocalizedString("Failed to refresh content. Please try refreshing the page.", language), {
                                            style: { zIndex: 9999 }
                                        });
                                    }
                                }, 1000); // 1 second delay to ensure server processing is complete
                            } else if (statusData.status === "FAILED") {
                                clearInterval(statusCheckId);
                                setScrapeStatus(`Scraping of ${siteUrl} failed: ${statusData.error || 'Unknown error'}`);
                                toast.error(await getLocalizedString(`Web scraping failed: ${statusData.error || 'Unknown error'}`, language), {
                                    style: { zIndex: 9999 }
                                });
                                setIsUploadButtonDisabled(false);
                                setUploadStatusMessage("");
                            } else {
                                // Still in progress - update with detailed status
                                setScrapeStatus(`${statusMessage}`);
                            }
                        } else {
                            // Handle error response from status endpoint
                            const errorText = await statusResponse.text();
                            console.warn("Status check returned error:", errorText);
                        }

                        checkCount++;
                        if (checkCount >= maxChecks) {
                            clearInterval(statusCheckId);
                            // Don't show error - job might still be running
                            setScrapeStatus(`Scraping of ${siteUrl} is taking longer than expected. Check back later.`);
                            setIsUploadButtonDisabled(false);
                            setUploadStatusMessage("");
                        }
                    } catch (error) {
                        console.error("Error checking status:", error);
                    }
                }, statusCheckInterval);

            } catch (error) {
                console.error("Error initiating website scrape:", error);
                toast.error(await getLocalizedString("Error initiating website scrape: " + (error instanceof Error ? error.message : String(error)), language), {
                    style: { zIndex: 9999 }
                });
                setScrapeStatus("Scraping request failed.");
                setIsUploadButtonDisabled(false);
                setUploadStatusMessage("");
            }
        } catch (error) {
            console.error("Unexpected error during scraping:", error);
            toast.error(await getLocalizedString("An unexpected error occurred during scraping.", language), {
                style: { zIndex: 9999 }
            });
            setScrapeStatus("Scraping encountered an error.");
            setIsUploadButtonDisabled(false);
            setUploadStatusMessage("");
        } finally {
            setIsLoading(false);
            // Note: We don't re-enable the button here because we want it to remain disabled
            // until the scraping process completes or fails, which happens in the interval handler
        }
    };

    const handleRoleChange = useCallback((roleData: RoleData) => {
        console.log('🔴 [ChatHome_Business] handleRoleChange triggered:', roleData);
        console.log('Role selected from dropdown:', roleData);

        // Create consistent role object with department
        const processedRoleData = {
            ...roleData,
            department: roleData.department // âœ… FIXED: Use original department from roleData
        };

        // Update local state
        setSelectedRole(processedRoleData);
        setIsRoleDropdownOpen(false);

        // Emit event with consistent data structure
        const eventData: RoleEventData = {
            role: processedRoleData.role,
            department: processedRoleData.department,
            source: 'dropdown'
        };

        eventBus.emit(EVENT_TYPES.ROLE_SELECTED, eventData);

        // Call parent handler with processed data
        if (onDropdownRoleSelect) {
            console.log('🔴 [ChatHome_Business] Calling onDropdownRoleSelect with:', processedRoleData);
            onDropdownRoleSelect(processedRoleData);
        } else {
            console.warn('🔴 [ChatHome_Business] onDropdownRoleSelect prop is missing!');
        }
    }, [onDropdownRoleSelect]);

    // Create a debounced version of handleExecuteTask
    const debouncedExecuteTask = useCallback(
        debounce((event: React.MouseEvent<HTMLButtonElement>) => {
            const actuallyExecuteTask = async (e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                // Prevent processing if already in progress
                if (isProcessingPayment) {
                    console.log("Payment already in progress, ignoring additional click");
                    return;
                }
                if (isRunButtonDisabled) return;
                setIsRunButtonDisabled(true);
                if (!selectedRole) {
                    toast.error(await getLocalizedString("Please select a persona.", language));
                    setIsRunButtonDisabled(false);
                    return;
                }
                try {
                    setIsProcessingPayment(true);
                    const response = await fetch("/api/get-role-mappings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            department: selectedRole.department,
                            role: selectedRole.role,
                        }),
                    });
                    if (!response.ok) {
                        throw new Error("Failed to get role mapping");
                    }
                    const roleMapping = await response.json();
                    const executionFee = roleMapping.price;

                    // Wait for payment to complete
                    // Duplicate process_payment, since there is another one in the ChatBase.tsx
                    // await process_payment(address!, executionFee, roleMapping.user);
                    setIsChatRunning(true);
                } catch (error) {
                    console.error("Error fetching role mapping:", error);
                    toast.error(await getLocalizedString("Error processing payment for role.", language));
                    setIsRunButtonDisabled(false);
                } finally {
                    // Set a slight delay before allowing new transactions
                    setTimeout(() => {
                        setIsProcessingPayment(false);
                    }, 5000); // 5 seconds lock to prevent rapid double-clicks
                }
            };

            actuallyExecuteTask(event);
        }, 500, { leading: true, trailing: false }),
        [isProcessingPayment, isRunButtonDisabled, selectedRole, address, language, process_payment]
    );

    // Update handleExecuteTask to use the debounced version
    const handleExecuteTask = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        debouncedExecuteTask(e);
    };

    const handleCleanup = async () => {
        if (!address) return;
        try {
            const response = await fetch("/api/cleanup_embedding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ namespace: address }),
            });
            if (response.ok) {
                toast.info(await getLocalizedString("Embedding segment cleaned up successfully", language));
            } else {
                console.error("Failed to clean up embedding segment");
                toast.info(await getLocalizedString("Failed to clean up embedding segment", language));
            }
        } catch (error) {
            console.error("Error cleaning up embedding segment:", error);
            toast.info(await getLocalizedString("Error cleaning up embedding segment:" + error, language));
        }
    };
    // Add near other useState hooks (line ~200 in your paste)
    const [embeddings, setEmbeddings] = useState<EmbeddingItem[]>([]);

    // Add this delete handler function in your component
    /* const handleDeleteEmbedding = async (namespace: string) => {
         if (window.confirm('Are you sure you want to delete this embedding?')) {
             try {
                 const response = await fetch('/api/cleanup-namespace', {
                     method: 'DELETE',
                     headers: {
                         'Content-Type': 'application/json',
                     },
                     body: JSON.stringify({ namespace }),
                 });
 
                 if (response.ok) {
                     // Remove the deleted embedding from the UI
                     setEmbeddings(prev => prev.filter(e => e.key !== namespace));
                     toast.success('Embedding deleted successfully');
                 } else {
                     throw new Error('Failed to delete embedding');
                 }
             } catch (error) {
                 console.error('Deletion error:', error);
                 toast.error('Error deleting embedding');
             }
         }
     };*/
    // Add near other localizedMessages state
    const [localizedDeleteConfirm, setLocalizedDeleteConfirm] = useState("Are you sure you want to delete this embedding?");

    // Localization effect for delete confirmation
    useEffect(() => {
        const updateDeleteConfirmation = async () => {
            const localizedText = await getLocalizedString("confirmDeleteEmbedding", selectedLanguage);
            setLocalizedDeleteConfirm(localizedText);
        };
        updateDeleteConfirmation();
    }, [selectedLanguage]);

    // Modified handleDeleteEmbedding function with localization
    const handleDeleteEmbedding = async (namespace: string) => {
        const confirmation = await getLocalizedString("confirmDeleteEmbedding", selectedLanguage);
        if (typeof window !== 'undefined') {
            if (window.confirm(confirmation)) {
                try {
                    const response = await fetch('/api/cleanup-namespace', {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ namespace }),
                    });

                    if (response.ok) {
                        // Localized success message
                        const successMessage = await getLocalizedString("embeddingDeletedSuccess", selectedLanguage);
                        setAvailableEmbeddings(prev => prev.filter(e => e.key !== namespace));
                        toast.success(successMessage);
                    } else {
                        throw new Error(await getLocalizedString("embeddingDeletionFailed", selectedLanguage));
                    }
                } catch (error) {
                    console.error('Deletion error:', error);
                    // Localized error message
                    const errorMessage = await getLocalizedString("embeddingDeletedError", selectedLanguage);
                    toast.error(errorMessage);
                }
            }
        }
    };



    useEffect(() => {
        setSelectedLanguage(language);
    }, [language]);

    // Note: The language drop-down has been removed from the upload modal.
    const handleLanguageChange = async (event: ChangeEvent<HTMLSelectElement>) => {
        const newLanguage = event.target.value;
        setSelectedLanguage(newLanguage);
    };
    const currentUserName = "currentuser"; // Replace with the authenticated user's username
    return (
        <>
            <Head>
                <title>Web3AIstore</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main className={styles.main}>
                <div className={styles.container}>
                    {!address ? (
                        <SignIn />
                    ) : (
                        <>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "1px",
                                    width: "100%",
                                }}
                            >
                                <h3
                                    style={{ cursor: selectedRole ? "pointer" : "default", marginRight: "20px" }}
                                    onClick={() => selectedRole && setIsRatingModalOpen(true)}
                                >
                                    {selectedRole ? <LocalizedText name="Review" /> : <LocalizedText name="GPT Chat" />}
                                </h3>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        width: "100%",
                                    }}
                                >
                                    <div
                                        ref={taskButtonRef}
                                        style={{
                                            flex: 1,
                                            position: "relative",
                                            textAlign: "center",
                                            display: "flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        <div
                                            style={{
                                                border: "2px solid #444",
                                                padding: "0.5rem 1rem",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                backgroundColor: "blue",
                                                position: "relative",
                                                maxWidth: "600px",
                                                flex: 1,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                            }}
                                            onClick={toggleTaskDropdown}
                                        >
                                            {selectedTask && (
                                                <span
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (selectedTask) toggleFavorite(selectedTask);
                                                    }}
                                                    style={{
                                                        cursor: "pointer",
                                                        color: favoriteTasks.includes(selectedTask) ? "gold" : "grey",
                                                        marginRight: "10px",
                                                        fontSize: "24px",
                                                    }}
                                                >
                                                    &#9733;
                                                </span>
                                            )}
                                            <p style={{ fontSize: "18px", margin: 0, flex: 1, textAlign: "left" }}>
                                                {selectedTask ? <LocalizedText name={selectedTask} /> : <LocalizedText name="Select a Task" />}
                                            </p>
                                            {selectedTask && (
                                                <div className={styles.tooltipWrapper} style={{ position: "relative" }}>
                                                    <button
                                                        ref={buttonRef}
                                                        style={{
                                                            marginRight: "0.2px",
                                                            padding: "0.1rem 0.5rem",
                                                            borderRadius: "4px",
                                                            cursor: isRunButtonDisabled ? "default" : "pointer",
                                                            backgroundColor: isRunButtonDisabled ? "#rgba(0, 208, 255, 0.95)" : "#0070f3",
                                                            color: "white",
                                                            border: "none",
                                                            fontSize: "18px",
                                                            fontWeight: "bold",
                                                            boxShadow: isRunButtonDisabled ? "none" : "2px 4px red",
                                                            transform: isRunButtonDisabled ? "none" : "scale(1)",
                                                            transition: "transform 0.2s",
                                                        }}
                                                        onClick={(e) => {
                                                            if (buttonRef.current?.getAttribute('data-processing') === 'true' || isProcessingPayment) {
                                                                return;
                                                            }
                                                            buttonRef.current?.setAttribute('data-processing', 'true');

                                                            // Pass the event to the handler
                                                            handleExecuteTask(e);

                                                            setTimeout(() => {
                                                                if (!isRunButtonDisabled && buttonRef.current) {
                                                                    buttonRef.current.removeAttribute('data-processing');
                                                                }
                                                            }, 3000);
                                                        }}

                                                        onMouseEnter={(e) => {
                                                            if (!isRunButtonDisabled) {
                                                                e.currentTarget.style.transform = "scale(0.8)";
                                                                e.currentTarget.style.backgroundColor = "#1e0af3";
                                                                e.currentTarget.style.boxShadow = "1px 2px red";
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (!isRunButtonDisabled) {
                                                                e.currentTarget.style.transform = "scale(1)";
                                                                e.currentTarget.style.backgroundColor = "#0070f3";
                                                                e.currentTarget.style.boxShadow = "2px 4px red";
                                                            }
                                                        }}
                                                        disabled={isRunButtonDisabled}
                                                    >
                                                        {isChatRunning ? <LocalizedText name="In Progress" /> : <LocalizedText name="Execute" />}
                                                    </button>
                                                    <span className={styles.tooltip}>
                                                        <LocalizedText name="Click to execute the task" />
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {isTaskDropdownOpen && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "100%",
                                                    left: 0,
                                                    width: "100%",
                                                    maxWidth: "600px",
                                                    backgroundColor: "blue",
                                                    padding: "1rem",
                                                    marginTop: "0px",
                                                    borderRadius: "8px",
                                                    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                                                    zIndex: 1000,
                                                    fontSize: 18,
                                                }}
                                            >{(tasks || []).map((task) => (
                                                <TaskItem
                                                    key={task}
                                                    task={task}
                                                    handleTaskChange={handleTaskChange}
                                                    handleDescriptionClick={handleDescriptionClick}
                                                    selectedTask={selectedTask}
                                                    activeButton={activeButton}
                                                    isFavorited={favoriteTasks.includes(task)}
                                                    toggleFavorite={toggleFavorite}
                                                />
                                            ))}

                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.tooltipWrapper}>
                                        {/* Combined Knowledge Base: Source selector + Open button */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                        }}>
                                            {/* Source Selector Dropdown */}
                                            {address && (
                                                <SourceSelector
                                                    userKey={address}
                                                    onSelectionChange={(sourceIds) => setKbSelectedSources(sourceIds)}
                                                    mcpEndpoint={process.env.NEXT_PUBLIC_MCP_ENDPOINT || 'http://localhost:3005'}
                                                />
                                            )}

                                            {/* Open Knowledge Base in new tab button */}
                                            <button
                                                style={{
                                                    padding: '8px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    backgroundColor: '#4f46e5',
                                                    color: 'white',
                                                    border: 'none',
                                                    fontSize: '14px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                }}
                                                onClick={() => {
                                                    const userKey = HashUtil.hashTo(address || '');
                                                    window.open(`/knowledge-base?userKey=${userKey}`, '_blank');
                                                }}
                                                aria-label="Manage Knowledge Base"
                                                title="Open Knowledge Base to add/manage sources"
                                            >
                                                ⚙️
                                            </button>
                                        </div>
                                        <span className={styles.tooltip}>
                                            <LocalizedText name="Select sources from Knowledge Base to enhance AI answers. Click gear to add/manage sources." />
                                        </span>
                                    </div>

                                    {/* The file upload modal */}


                                    {isModalOpen && (
                                        <div
                                            onClick={(e) => {
                                                if (e.target === e.currentTarget) {
                                                    e.stopPropagation();
                                                }
                                            }}
                                            style={{
                                                position: 'fixed',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                backgroundColor: 'rgba(0, 0, 0, 0.92)',
                                                backdropFilter: 'blur(4px)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                zIndex: 9999,
                                            }}>
                                            <div style={{
                                                width: '90%',
                                                maxWidth: '1200px',
                                                height: '85vh',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                position: 'relative',
                                            }}>
                                                <button
                                                    onClick={handleCloseFileModal}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '10px',
                                                        right: '10px',
                                                        zIndex: 1001,
                                                        background: 'rgba(0,0,0,0.5)',
                                                        border: 'none',
                                                        color: '#fff',
                                                        fontSize: '24px',
                                                        cursor: 'pointer',
                                                        borderRadius: '50%',
                                                        width: '40px',
                                                        height: '40px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    x
                                                </button>
                                                <FileSearchKnowledgeBase
                                                    userKey={HashUtil.hashTo(address || '')}
                                                    onClose={handleCloseFileModal}
                                                    onSourcesSelected={(sources) => {
                                                        console.log('Selected sources:', sources);
                                                        toast.success('Selected ' + sources.length + ' source(s)');
                                                        handleCloseFileModal();
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {isLoading && (
                                        <div className={styles.modalOverlay1}>
                                            <div className={styles.modalContent1}>
                                                <div style={{ textAlign: "center" }}>
                                                    <p>
                                                        <LocalizedText name="Loading..." />
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        ref={roleButtonRef}
                                        style={{
                                            position: "relative",
                                            width: "100%",
                                            maxWidth: "400px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                marginLeft: "1rem",
                                                border: "2px solid #444",
                                                padding: "0.5rem 1rem",
                                                borderRadius: "8px",
                                                cursor: "pointer",
                                                backgroundColor: "blue",
                                                position: "relative",
                                                zIndex: 1000,
                                                width: "100%",
                                                boxSizing: "border-box",
                                            }}
                                            onClick={toggleRoleDropdown}
                                        >
                                            <p style={{ fontSize: "17px", margin: 0 }}>
                                                {selectedRole ? <LocalizedText name={selectedRole.role} /> : <LocalizedText name="Select a Persona" />}
                                            </p>
                                        </div>
                                        {isRoleDropdownOpen && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    top: "100%",
                                                    left: 0,
                                                    width: "100%",
                                                    backgroundColor: "blue",
                                                    padding: "1rem",
                                                    marginTop: "0px",
                                                    borderRadius: "8px",
                                                    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
                                                    zIndex: 1000,
                                                    fontSize: "18px",
                                                }}
                                            >
                                                {roles.map((role) => (
                                                    <RoleItem
                                                        key={role.role}
                                                        role={role.role}
                                                        department={role.department}
                                                        handleRoleChange={handleRoleChange}
                                                        handleRoleDescriptionClick={handleRoleDescriptionClick}
                                                        selectedRole={selectedRole?.role ?? null}
                                                        activeRoleButton={activeRoleButton}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {/* Pass selected embeddings to ChatBase via props extension */}
                            {isChatRunning && selectedTask && selectedRole && (
                                <ChatBase
                                    key={`${selectedRole?.role}-${selectedTask}`}
                                    {...({
                                        role: selectedRole?.role || "",
                                        task: selectedTask || "",
                                        department: selectedRole?.department || "",
                                        kbSelectedSources: kbSelectedSources, // Use the actual kbSelectedSources from SourceSelector
                                    } as any)}
                                />
                            )}
                            {isRatingModalOpen && (
                                <RatingComponent
                                    tokenId={selectedRole?.role || ""}
                                    department={selectedRole?.department || ""}
                                    role={selectedRole?.role || ""}
                                    onClose={() => setIsRatingModalOpen(false)}
                                />
                            )}
                        </>
                    )}
                </div>
                {isTaskModalVisible && (
                    <div
                        ref={modalRef}
                        style={{
                            position: "absolute",
                            top: modalPosition.top,
                            left: modalPosition.left,
                            backgroundColor: "blue",
                            color: "white",
                            padding: "15px",
                            border: "1px solid #ccc",
                            borderRadius: "8px",
                            boxShadow: "2px 2px 5px darkred",
                            width: "400px",
                            zIndex: 1000,
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
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsTaskModalVisible(false);
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
                {isRoleModalVisible && (
                    <div
                        ref={modalRef}
                        style={{
                            position: "absolute",
                            top: roleModalPosition.top,
                            left: roleModalPosition.left,
                            backgroundColor: "blue",
                            color: "white",
                            padding: "15px",
                            border: "1px solid #ccc",
                            borderRadius: "8px",
                            boxShadow: "2px 2px 5px darkred",
                            width: "450px",
                            zIndex: 1000,
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
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsRoleModalVisible(false);
                            }}
                        >
                            &times;
                        </button>
                        <h4 style={{ textAlign: "center", marginTop: "6px", marginBottom: "10px" }}>
                            <LocalizedText name={`Persona Description `} />
                        </h4>
                        <p style={{ marginTop: "20px" }}>
                            {roleDescription ? (
                                roleDescription
                            ) : (
                                <LocalizedText name="Please wait, Still loading ...." />
                            )}
                        </p>
                    </div>
                )}
            </main>
        </>
    );
};

export default ChatHome;

// Disable static generation for these pages
export async function getServerSideProps() {
    return {
        props: {},
    };
}
