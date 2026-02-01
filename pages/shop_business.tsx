// pages/Shop_marketing.tsx

import React, { useState, useEffect, ChangeEvent, useContext, useMemo, useRef } from 'react';

import styles from '../styles/Shop_marketing.module.css';
import { useActiveAccount } from '../hooks/useWalletAddress';
import { useRouter } from 'next/router';
import { LocalizedText } from '../util/LocalizedText';
import { toast } from 'react-toastify';
import { LocalizationContext } from '../util/LocalizationContext';
import { getLocalizedString } from '../util/LocalizedText';
import AutoFitText from '../components/AutoFitText';
import { ChatModalContext } from '../context/ChatModalContext'; // Correct import path
import { eventBus, EVENT_TYPES, RoleEventData } from '../utils/eventBus';

// Removed DOMPurify import as per request
// import DOMPurify from 'dompurify'; // For sanitizing HTML

interface RoleMapping {
    department: string;
    role: string;
    apiKey: string;
    user: string;
    price: string;
    image: string;
    usage: number; // New field for tracking usage
}

interface RoleData {
    department: string;
    role: string;
}

// Rating Component
interface RatingProps {
    value: number;
}

const Rating = ({ value }: RatingProps) => {
    const totalStars = 5;
    return (
        <div>
            {[...Array(totalStars)].map((_, i) => (
                <span key={i} style={{ color: i < value ? 'gold' : 'grey' }}>
                    ★
                </span>
            ))}
        </div>
    );
};

// Update the prop default value as well
interface ShopProps {
    selectedCategory?: string;
    isExpanded?: boolean;
    onRoleSelect?: (role: any) => void;
    selectedRole?: any;  // Add the missing selectedRole prop
    isRoleFromURL?: boolean;  // ✅ Add this prop
}

const Shop: React.FC<ShopProps> = ({
    selectedCategory = 'Favorite',
    isExpanded = false,
    onRoleSelect,
    selectedRole,
    isRoleFromURL = false  // ✅ Add this prop with default value
}) => {

    // Add state to track role from event bus
    const [eventSelectedRole, setEventSelectedRole] = useState<RoleEventData | null>(null);
    // Track when category change is triggered by role selection (to prevent reset)
    const roleTriggeredCategoryChange = useRef(false);

    // Use event-selected role or prop-selected role (priority to event)
    // const currentSelectedRole = eventSelectedRole || selectedRole;
    // Enhanced role selection logic with proper fallback
    const currentSelectedRole = useMemo(() => {
        if (eventSelectedRole) {
            return {
                ...eventSelectedRole,
                department: eventSelectedRole.department || 'Favorite',
                role: eventSelectedRole.role
            };
        }
        return selectedRole;
    }, [eventSelectedRole, selectedRole]);

    // Debug logging for expand pane state
    useEffect(() => {
        console.log('Expand pane state:', {
            eventSelectedRole,
            selectedRole,
            currentSelectedRole,
            isExpanded,
            breadcrumb,
            selectedCategory
        });
    }, [eventSelectedRole, selectedRole, currentSelectedRole, isExpanded]);

    // Add this useEffect to both shop components
    useEffect(() => {
        const checkUrlParams = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const urlRole = urlParams.get('selectedRole');
            const urlCategory = urlParams.get('selectedCategory');
            const selectedTask = urlParams.get('selectedTask');

            if (urlRole && urlCategory) {
                const roleData = {
                    role: decodeURIComponent(urlRole),
                    department: decodeURIComponent(urlCategory),
                    task: selectedTask ? decodeURIComponent(selectedTask) : '',
                    source: 'url' as const
                };

                // Directly set eventSelectedRole for immediate display
                setEventSelectedRole(roleData);

                // Also emit the event for other components
                eventBus.emitRoleFromURL(roleData);
                console.log('URL parameters detected in shop, setting role:', roleData);
            }
        };

        // Check on component mount
        checkUrlParams();
    }, []);
    const [isRolePaneExpanded, setIsRolePaneExpanded] = useState(false);



    // Add event listener for role selection
    // Enhanced event listener for role selection
    useEffect(() => {
        const handleRoleSelection = (roleData: RoleEventData) => {
            console.log('🟢 [shop_business] Received ROLE_SELECTED event:', roleData);
            console.log('Shop received role selection event:', roleData);

            // Ensure department is set for dropdown selections
            const processedRoleData = {
                ...roleData,
                department: roleData.department || 'Favorite'
            };

            setEventSelectedRole(processedRoleData);

            // Mark that category change (if any) is triggered by role selection
            roleTriggeredCategoryChange.current = true;

            // Force re-render of expand pane
            setTimeout(() => {
                eventBus.emit(EVENT_TYPES.EXPAND_PANE_UPDATE, {
                    //eventBus.emit(EVENT_TYPES.SHOP_COLLAPSED, {
                    breadcrumb: ` ${processedRoleData.department} → ${processedRoleData.role}`,
                    role: processedRoleData
                });
            }, 0);
        };

        const handleCategoryChange = (data: any) => {
            console.log('Shop received category change:', data);
            setEventSelectedRole(null);
            setIsContentVisible(true);
        };

        // Listen for all role selection events
        eventBus.on(EVENT_TYPES.ROLE_SELECTED, handleRoleSelection);
        eventBus.on(EVENT_TYPES.ROLE_FROM_URL, handleRoleSelection);
        eventBus.on(EVENT_TYPES.CATEGORY_CHANGED, handleCategoryChange);

        return () => {
            eventBus.off(EVENT_TYPES.ROLE_SELECTED, handleRoleSelection);
            eventBus.off(EVENT_TYPES.ROLE_FROM_URL, handleRoleSelection);
            eventBus.off(EVENT_TYPES.CATEGORY_CHANGED, handleCategoryChange);
        };
    }, []);



    const [currentCategory, setCurrentCategory] = useState('Favorite');

    const [categories, setCategories] = useState<string[]>([]);

    const [roles, setRoles] = useState<RoleData[]>([]);
    const [roleMappings, setRoleMappings] = useState<Record<string, RoleMapping[]>>({});
    const [favoritedRoleMappings, setFavoritedRoleMappings] = useState<RoleMapping[]>([]);
    const [imageMapping, setImageMapping] = useState<Record<string, string>>({});
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [usage, setUsage] = useState<Record<string, number>>({}); // New state for usage
    const [hoveredImage, setHoveredImage] = useState<string | null>(null); // For image tooltip
    const [hoveredRole, setHoveredRole] = useState<string | null>(null); // For role name tooltip
    const [activeRoleButton, setActiveRoleButton] = useState<string | null>(null); // Track the active role button
    const address = useActiveAccount()?.account?.address;
    const router = useRouter();
    const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
    const [currentRoleDescription, setCurrentRoleDescription] = useState<string>('');
    const [currentRole, setCurrentRole] = useState<string>('');
    const [selectedLanguage, setSelectedLanguage] = useState<string>('English'); // Added selectedLanguage
    // Add this state variable near other state declarations
    const [isProcessingRole, setIsProcessingRole] = useState<Set<string>>(new Set());

    const [roleModalPosition, setRoleModalPosition] = useState({ top: 0, left: 0 });
    const { language } = useContext(LocalizationContext);
    const [isChatModalOpen, setIsChatModalOpen] = useState<boolean>(false);
    const { openChat } = useContext(ChatModalContext);
    // Added state management for chat inputs and messages
    const [input, setInput] = useState({
        query: '',
    });

    const [messages, setMessages] = useState<any[]>([]);

    // State variables for chat departments and roles
    const [chatDepartments, setChatDepartments] = useState<string[]>([]);
    const [chatRoles, setChatRoles] = useState<string[]>(['ALL']);
    const [selectedChatDepartment, setSelectedChatDepartment] = useState<string>('ALL');
    const [selectedChatRole, setSelectedChatRole] = useState<string>('ALL');
    const [companyNames, setCompanyNames] = useState<string[]>([]);
    // Add these state variables for enhanced toggle functionality
    const [selectedRoleName, setSelectedRoleName] = useState('');
    // Add state for controlling content visibility
    //const [isContentVisible, setIsContentVisible] = useState(true);
    const [isContentVisible, setIsContentVisible] = useState<boolean>(isExpanded);
    // REMOVED: lastUserAddedRole and hasShownToastForRole refs
    // const lastUserAddedRole = useRef<string | null>(null);
    // const hasShownToastForRole = useRef<string | null>(null);
    const [isShopCollapsed, setIsShopCollapsed] = useState(false);
    const [isRoleExpanded, setIsRoleExpanded] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedRole, setExpandedRole] = useState<RoleData | null>(null);



    // Handle input changes for chat input
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput({
            query: e.target.value,
        });
    };

    // Add these interfaces and state declarations near your other state variables
    interface NameData {
        companyName: string | null;
        userName: string | null;
    }
    // const [userId, setUserId] = useState<string>("anonymous");
    const userId = address;
    const [nameData, setNameData] = useState<NameData>({ companyName: null, userName: null });
    const [tempCompanyName, setTempCompanyName] = useState<string>("");
    const [tempUserName, setTempUserName] = useState<string>("");
    const [showCompanyModal, setShowCompanyModal] = useState<boolean>(false);
    const [showUserModal, setShowUserModal] = useState<boolean>(false);
    const [summariesLoaded, setSummariesLoaded] = useState<boolean>(false);
    // Add state to track if the company name was selected from dropdown
    const [isDropdownSelection, setIsDropdownSelection] = useState<boolean>(false);
    // Add useEffect to trigger pre-population

    const [cacheStats, setCacheStats] = useState({
        hits: 0,
        misses: 0,
        totalRequests: 0
    });

    // Add simple state for role summary
    const [currentRoleSummary, setCurrentRoleSummary] = useState<string>('');
    const [isRoleSummaryLoading, setIsRoleSummaryLoading] = useState<boolean>(false);

    // New efficient batch loading state
    const [roleSummaries, setRoleSummaries] = useState<Map<string, string>>(new Map());
    const [batchLoading, setBatchLoading] = useState<boolean>(false);
    const [loadingLanguages, setLoadingLanguages] = useState<Set<string>>(new Set());

    // Batch load role summaries
    const loadRoleSummariesBatch = async (roles: RoleData[], targetLanguage: string) => {
        if (roles.length === 0 || loadingLanguages.has(targetLanguage)) return;

        setLoadingLanguages(prev => new Set(prev).add(targetLanguage));
        setBatchLoading(true);

        try {
            console.log(`Loading batch of ${roles.length} summaries for language: ${targetLanguage}`);

            const batchRequest = roles.map(({ department, role }) => ({
                department,
                role,
                language: targetLanguage
            }));

            const response = await fetch('/api/get_role_summary_batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ batch: batchRequest })
            });

            if (response.ok) {
                const data = await response.json();

                if (data.success && data.mapping) {
                    // Update role summaries with batch results
                    setRoleSummaries(prev => {
                        const updated = new Map(prev);
                        Object.entries(data.mapping).forEach(([key, summary]) => {
                            updated.set(key, summary as string);
                        });
                        return updated;
                    });

                    console.log(`Batch loaded successfully: ${data.stats?.successful || 0} successful, ${data.stats?.cached || 0} cached, ${data.stats?.errors || 0} errors`);

                    // Show toast for errors if any
                    if (data.stats?.errors > 0) {
                        toast.warn(`${data.stats.errors} role summaries failed to load and are using fallbacks`);
                    }
                }
            } else {
                throw new Error(`Batch request failed: ${response.status}`);
            }
        } catch (error) {
            console.error(`Batch loading failed for language ${targetLanguage}:`, error);

            // Create fallback summaries for failed batch
            roles.forEach(({ department, role }) => {
                const key = `${department}:${role}:${targetLanguage}`;
                if (!roleSummaries.has(key)) {
                    const fallback = `Professional ${role.toLowerCase()} in ${department.toLowerCase()}.`;
                    setRoleSummaries(prev => new Map(prev).set(key, fallback));
                }
            });

            toast.error(`Failed to load role summaries for ${targetLanguage}. Using fallbacks.`);
        } finally {
            setBatchLoading(false);
            setLoadingLanguages(prev => {
                const updated = new Set(prev);
                updated.delete(targetLanguage);
                return updated;
            });
        }
    };

    // Handle multiple batches for roles over 20
    const loadRoleSummariesInBatches = async (roles: RoleData[], targetLanguage: string) => {
        if (roles.length === 0 || loadingLanguages.has(targetLanguage)) return;

        const BATCH_SIZE = 20;
        const batches: RoleData[][] = [];

        // Split roles into batches of 20
        for (let i = 0; i < roles.length; i += BATCH_SIZE) {
            batches.push(roles.slice(i, i + BATCH_SIZE));
        }

        console.log(`Processing ${roles.length} roles in ${batches.length} batches for language: ${targetLanguage}`);

        setLoadingLanguages(prev => new Set(prev).add(targetLanguage));
        setBatchLoading(true);

        try {
            // Process batches sequentially
            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} roles`);

                await loadRoleSummariesBatch(batch, targetLanguage);

                // Small delay between batches to prevent API overload
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log(`Successfully loaded summaries for all ${roles.length} roles in ${targetLanguage}`);
        } catch (error) {
            console.error(`Failed to load summaries in batches for ${targetLanguage}:`, error);
            toast.error(`Failed to load role summaries for ${targetLanguage}`);
        } finally {
            setBatchLoading(false);
            setLoadingLanguages(prev => {
                const updated = new Set(prev);
                updated.delete(targetLanguage);
                return updated;
            });
        }
    };


    // Load summaries for current language (API handles English generation internally)
    useEffect(() => {
        if (roles.length === 0 || !language) return;

        // Get all roles for current category
        const rolesToLoad = currentCategory === 'Favorite'
            ? roles // Load all favorite roles
            : roles.filter(({ department }) => department === currentCategory);

        console.log(`Loading ${language} summaries for ${rolesToLoad.length} roles...`);

        // Use multiple batches for roles over 20
        if (rolesToLoad.length > 20) {
            loadRoleSummariesInBatches(rolesToLoad, language);
        } else {
            loadRoleSummariesBatch(rolesToLoad, language);
        }
    }, [roles, currentCategory, language]); // Single effect that handles all languages


    // Simple and efficient getRoleSummary function
    const getRoleSummary = (department: string, role: string): string => {
        const targetKey = `${department}:${role}:${language}`;

        // Return target language summary if available
        if (roleSummaries.has(targetKey)) {
            return roleSummaries.get(targetKey)!;
        }

        // Show loading state or fallback
        return batchLoading ? 'Loading...' : `Professional ${role.toLowerCase()} in ${department.toLowerCase()}.`;
    };





    // Helper functions to fetch and update names
    const fetchCompanyName = async (userAddress: string): Promise<string | null> => {
        try {
            const res = await fetch(`/api/getCompanyName?userAddress=${encodeURIComponent(userAddress)}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`[Shop] Retrieved company name: ${data.companyName}`);
                return data.companyName;
            }
        } catch (error) {
            console.error("Error fetching company name:", error);
        }
        return null;
    };

    const fetchUserName = async (userAddress: string): Promise<string | null> => {
        try {
            const res = await fetch(`/api/getUserName?userAddress=${encodeURIComponent(userAddress)}`);
            if (res.ok) {
                const data = await res.json();
                console.log(`[Shop] Retrieved user name: ${data.userName}`);
                return data.userName;
            }
        } catch (error) {
            console.error("Error fetching user name:", error);
        }
        return null;
    };

    const handleSetCompanyName = async () => {
        // Check for empty name
        if (!tempCompanyName.trim()) {
            toast.error("Please enter a company name.");
            return;
        }

        // Check if the name already exists in the list (case-insensitive)
        const normalizedInput = tempCompanyName.trim().toLowerCase();
        const existsInList = companyNames.some(
            (name) => name.toLowerCase() === normalizedInput
        );

        // Only block if user typed a name that matches an existing one
        // but isDropdownSelection is false (meaning they didn't select from dropdown)
        // AND the exact case-sensitive name doesn't exist (user is trying to create new)
        const exactMatchExists = companyNames.includes(tempCompanyName.trim());

        // If name exists in list, allow it (user is selecting existing company)
        // If name doesn't exist, allow it (user is creating new company)
        // Only block if user types a variant of existing name (case mismatch)
        if (existsInList && !exactMatchExists && !isDropdownSelection) {
            toast.error("This company name already exists. Please choose a different name or select it from the dropdown.");
            return;
        }

        try {
            const res = await fetch('/api/setCompanyName', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: userId, companyName: tempCompanyName.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setNameData(prev => ({ ...prev, companyName: data.companyName }));
                setShowCompanyModal(false);
            } else {
                toast.error("Failed to set company name.");
            }
        } catch (error) {
            console.error("Error setting company name:", error);
            toast.error("Error setting company name.");
        }
    };

    const handleSetUserName = async () => {
        // Check for empty name
        if (!tempUserName.trim()) {
            toast.error("Please enter your name.");
            return;
        }

        try {
            // First check if the name already exists
            const checkRes = await fetch(`/api/checkUserNameExists?userName=${encodeURIComponent(tempUserName.trim())}`);
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.exists) {
                    toast.error("This name is already taken. Please choose a different name.");
                    return;
                }
            }

            // Name is available, proceed to set it
            const res = await fetch('/api/setUserName', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: userId, userName: tempUserName.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setNameData(prev => ({ ...prev, userName: data.userName }));
                setShowUserModal(false);
            } else {
                toast.error("Failed to set user name.");
            }
        } catch (error) {
            console.error("Error setting user name:", error);
            toast.error("Error setting user name.");
        }
    };

    // Format results from API response with hyperlinks
    const formatResults = (results: any[]) => {
        if (!results || results.length === 0) {
            return <p>No matching tasks found.</p>;
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

        const formattedResults = results.map((result, index) => {
            const encodedRole = encodeURIComponent(result.role);
            const encodedDepartment = encodeURIComponent(result.department);
            const encodedTask = encodeURIComponent(result.task);
            const url = `${baseUrl}/ChatHome_bus?selectedRole=${encodedRole}&selectedCategory=${encodedDepartment}&selectedTask=${encodedTask}`;
            console.log("-----------the url is ", url);
            return (
                <div key={index} className={styles.resultItem}>
                    <strong>{index + 1}. Department:</strong> {result.department}
                    <br />
                    <strong>Role:</strong> {result.role}
                    <br />
                    <strong>Task:</strong>{' '}
                    <a href={url} target="_blank" rel="noopener noreferrer">
                        {result.task}
                    </a>
                    <br />
                    <strong>Score:</strong> {result.score.toFixed(2)}
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
                        content: data.error || 'An error occurred.',
                    },
                ]);
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages((prevMessages) => [
                ...prevMessages,
                {
                    role: 'assistant',
                    content: 'An error occurred while processing your request.',
                },
            ]);
        }

        // Reset the input field
        setInput({
            query: '',
        });
    };

    const [isLoadingRoles, setIsLoadingRoles] = useState(true);

    useEffect(() => {
        let isMounted = true; // Prevent state update if component unmounts

        const fetchUserSelectedRoles = async () => {
            if (!address) {
                setIsLoadingRoles(false);
                return;
            }

            setIsLoadingRoles(true);

            try {
                const response = await fetch('/api/get-role-mapping', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress: address }),
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch selected roles');
                }

                const data = await response.json();
                const selectedRoleKeys = data.map(
                    (item: { department: string; role: string }) => `${item.department}:${item.role}`
                );
                if (isMounted) {
                    setSelectedRoles(selectedRoleKeys);
                }
            } catch (error) {
                console.error('Error fetching user selected roles:', error);
                if (isMounted) {
                    setSelectedRoles([]);
                }
            } finally {
                if (isMounted) {
                    setIsLoadingRoles(false);
                }
            }
        };

        fetchUserSelectedRoles();

        return () => {
            isMounted = false;
        };
    }, [address]);

    useEffect(() => {
        if (selectedCategory === 'Favorite') {
            fetchFavoritedRoleMappings();
        } else {
            fetchRolesInCategory();
        }
    }, [address, selectedCategory]);

    // In your component
    // const [currentCategory, setCurrentCategory] = useState(selectedCategory);

    useEffect(() => {
        setCurrentCategory(selectedCategory);
    }, [selectedCategory]);




    // Update the filtering logic to use the passed category
    const filteredResults = useMemo(() => {
        // Add type guard to ensure roleMappings is an array
        if (!roleMappings || !Array.isArray(roleMappings)) {
            return [];
        }
        // Filter roles based on currentCategory instead of local state
        return roleMappings.filter((role: RoleMapping) => {
            if (currentCategory === 'Favorite') {
                // Show favorite roles logic
                return role.department === 'favorites' || role.usage > 10;
            }
            return role.department.toLowerCase() === currentCategory.toLowerCase();
        });
    }, [currentCategory, roleMappings]);

    const handleRoleClick = (role: RoleMapping) => {
        setSelectedRoleName(role.role); // Add this line
        if (onRoleSelect) {
            onRoleSelect(role);
        }
        // Notify Navbar about role selection
        if (window.setSelectedRole) {
            window.setSelectedRole(role.role);
        }

        // Close the shop section, keep only expand bar visible
        setIsContentVisible(false);

        //setIsExpanded(false);
    };

    const fetchRolesInCategory = async () => {
        if (!selectedCategory) return;

        try {
            const roles = await fetchRoles(selectedCategory);
            setRoles(roles);

            const mappings = await Promise.all(roles.map(({ department, role }) => fetchRoleMapping(department, role)));
            setRoleMappings((prev) => ({ ...prev, [selectedCategory]: mappings }));

            const imageMap: Record<string, string> = {};
            mappings.forEach((mapping) => {
                imageMap[`${mapping.department}:${mapping.role}`] = mapping.image;
            });
            setImageMapping(imageMap);

            await fetchRatingsAndUsage(roles);
        } catch (error) {
            console.error('Error fetching roles in category:', error);
        }
    };

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await fetch('/api/get-departments');
                if (!response.ok) {
                    throw new Error('Failed to fetch categories');
                }
                const categoryData = await response.json();
                setCategories(categoryData);
            } catch (error) {
                console.error('Error fetching categories:', error);
            }
        };
        fetchCategories();
    }, []);



    useEffect(() => {
        if (userId) {
            const initNames = async () => {
                const companyName = await fetchCompanyName(userId);
                const userName = await fetchUserName(userId);
                console.log(`[Shop] Retrieved company name: ${companyName}`);
                console.log(`[Shop] Retrieved user name: ${userName}`);
                setNameData({ companyName, userName });
                if (!companyName) {
                    console.log("[Shop] No company name found. Opening company sub-modal.");
                    setShowCompanyModal(true);
                } else {
                    setShowCompanyModal(false);
                }
                if (!userName) {
                    console.log("[Shop] No user name found. Opening user sub-modal.");
                    setShowUserModal(true);
                } else {
                    setShowUserModal(false);
                }
            };
            initNames();
        }
    }, [userId, address]);

    useEffect(() => {
        if (showCompanyModal) {
            const fetchCompanyNames = async () => {
                try {
                    // Call your endpoint that returns an array of company names.
                    const res = await fetch('/api/getCompanyNames');
                    if (res.ok) {
                        const data = await res.json();
                        // Expect data.companyNames to be an array of strings.
                        setCompanyNames(data.companyNames || []);
                    } else {
                        console.error('Failed to fetch company names.');
                    }
                } catch (error) {
                    console.error('Error fetching company names:', error);
                }
            };
            fetchCompanyNames();
        }
    }, [showCompanyModal]);

    const fetchRoles = async (category: string): Promise<RoleData[]> => {
        try {
            const response = await fetch('/api/get-roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: category }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch roles');
            }

            const data = await response.json();
            return Array.isArray(data.roles) ? data.roles.map((role: string) => ({ department: category, role })) : [];
        } catch (error) {
            console.error('Error fetching roles:', error);
            return [];
        }
    };

    const fetchRoleMapping = async (department: string, role: string): Promise<RoleMapping> => {
        try {
            const response = await fetch('/api/get-role-mappings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department, role }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch role mapping');
            }

            const data = await response.json();
            return { ...data, department, role, usage: data.usage || 0 };
        } catch (error) {
            console.error('Error fetching role mapping:', error);
            return { department, role, apiKey: '', user: '', price: '', image: '', usage: 0 };
        }
    };

    const fetchFavoritedRoleMappings = async () => {
        if (!address) return;

        try {
            const response = await fetch('/api/get-role-by-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch favorited roles');
            }

            let roleData: RoleData[] = await response.json();

            // Remove duplicates from roleData
            roleData = Array.from(new Map(roleData.map((item) => [`${item.department}:${item.role}`, item])).values());

            setRoles(roleData);

            const allMappings: RoleMapping[] = [];
            for (const { department, role } of roleData) {
                const mapping = await fetchRoleMapping(department, role);
                allMappings.push(mapping);
            }

            setFavoritedRoleMappings(allMappings);

            const imageMap: Record<string, string> = {};
            allMappings.forEach((mapping) => {
                const key = `${mapping.department}:${mapping.role}`;
                imageMap[key] = mapping.image;
            });
            setImageMapping(imageMap);

            await fetchRatingsAndUsage(roleData);

            // Automatically check favorited roles
            const uniqueSelectedRoles = Array.from(new Set(allMappings.map((mapping) => `${mapping.department}:${mapping.role}`)));
            setSelectedRoles(uniqueSelectedRoles);
        } catch (error) {
            console.error('Error fetching favorited roles:', error);
        }
    };

    const fetchRatingsAndUsage = async (roles: RoleData[]) => {
        const ratingsMap: Record<string, number> = {};
        const usageMap: Record<string, number> = {};

        for (const { department, role } of roles) {
            try {
                // Fetch average rating
                const ratingResponse = await fetch('/api/getAvgRating', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ department, role }),
                });

                if (!ratingResponse.ok) {
                    throw new Error(`Failed to fetch rating for role: ${role}`);
                }

                const ratingData = await ratingResponse.json();
                ratingsMap[`${department}:${role}`] = ratingData.averageRating;

                // Fetch usage
                const usageResponse = await fetch('/api/getUsage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ department, role }),
                });

                if (!usageResponse.ok) {
                    throw new Error(`Failed to fetch usage for role: ${role}`);
                }

                const usageData = await usageResponse.json();
                usageMap[`${department}:${role}`] = usageData.usage;
            } catch (error) {
                console.error(`Error fetching data for role ${role}:`, error);
            }
        }

        setRatings(ratingsMap);
        setUsage(usageMap);
    };

    const handleCategoryChange = async (event: ChangeEvent<HTMLSelectElement>) => {
        const category = event.target.value;

        // ENHANCED: Force reset selected role when category changes
        setSelectedRoleName('');

        // Update current category immediately
        setCurrentCategory(category);

        // Clear navbar role selection
        if (window.setSelectedRole) {
            window.setSelectedRole('');
        }

        // Clear any visual selection states
        setSelectedRoles([]);
        setImageMapping({});
        setActiveRoleButton(null);
        setIsContentVisible(true);

        // Reset other related states
        setRoles([]);

        if (category === 'Favorite') {
            await fetchFavoritedRoleMappings();
        } else {
            const roles = await fetchRoles(category);
            setRoles(roles);

            const mappings = await Promise.all(roles.map(({ department, role }) => fetchRoleMapping(department, role)));
            setRoleMappings((prev) => ({ ...prev, [category]: mappings }));

            const imageMap: Record<string, string> = {};
            mappings.forEach((mapping) => {
                imageMap[`${mapping.department}:${mapping.role}`] = mapping.image;
            });
            setImageMapping(imageMap);

            await fetchRatingsAndUsage(roles);
        }
    };

    // Add this useEffect to detect category changes from any source
    const firstCategoryChange = useRef(true);

    useEffect(() => {
        if (isRoleFromURL) {
            console.log('[CategoryChange] Category change ignored because role came from URL.');
            setIsContentVisible(false);
            return;  // ✅ Skip reset if role is from URL
        }
        if (firstCategoryChange.current) {
            console.log('[CategoryChange] Skipping initial reset on mount/navigation.');
            firstCategoryChange.current = false;
            return;
        }
        // Skip reset if category change was triggered by role selection
        if (roleTriggeredCategoryChange.current) {
            console.log('[CategoryChange] Category change triggered by role selection, skipping reset.');
            roleTriggeredCategoryChange.current = false;
            return;
        }
        console.log(`[CategoryChange] Category changed by user to '${currentCategory}'. Resetting selectedRoleName and calling window.setSelectedRole('').`);
        setSelectedRoleName('');
        if (window.setSelectedRole) {
            window.setSelectedRole('');
        }
    }, [currentCategory, isRoleFromURL]);  // ✅ Add isRoleFromURL to dependencies




    const [breadcrumb, setBreadcrumb] = useState<string>('');

    useEffect(() => {
        const handleExpandPaneUpdate = (data: { breadcrumb: string, role: RoleEventData }) => {
            // Guard against undefined data
            if (!data || !data.role) {
                console.warn('🔄 Received invalid expand pane data, ignoring:', data);
                return;
            }
            // Update local state with breadcrumb or role display
            console.log("🔄 Updating expand pane:", data);
            setBreadcrumb(data.breadcrumb);
            setEventSelectedRole(data.role);
        };

        eventBus.on(EVENT_TYPES.EXPAND_PANE_UPDATE, handleExpandPaneUpdate);

        return () => {
            eventBus.off(EVENT_TYPES.EXPAND_PANE_UPDATE, handleExpandPaneUpdate);
        };
    }, []);


    const handleRoleToggle = async (role: string, department: string) => {
        if (!address) {
            toast.info('Please connect your wallet.');
            return;
        }

        const roleKey = `${department}:${role}`;
        const isSelected = selectedRoles.includes(roleKey);
        const newSelectedRoles = isSelected ? selectedRoles.filter((r) => r !== roleKey) : [...selectedRoles, roleKey];

        setSelectedRoles(newSelectedRoles);

        const selectedLocalizedMessage = await getLocalizedString('got selected', language);
        const deselectedLocalizedMessage = await getLocalizedString('got deselected', language);

        const localizedRole = await getLocalizedString(role, language);

        if (isSelected) {
            toast.info(`${localizedRole} ${deselectedLocalizedMessage}`, { autoClose: 5000 });
        } else {
            toast.success(`${localizedRole} ${selectedLocalizedMessage}`, { autoClose: 5000 });
        }

        const endpoint = isSelected ? '/api/remove-role-mapping' : '/api/add-role-mapping';
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: address, department, role }),
            });

            if (!response.ok) {
                throw new Error('Failed to update role mapping');
            }

            // ✅ ADD: Broadcast favorite update event
            const favoriteUpdateEvent = new CustomEvent('favoriteRoleUpdated', {
                detail: {
                    action: isSelected ? 'remove' : 'add',
                    role: { department, role },
                    userAddress: address,
                    timestamp: Date.now()
                }
            });
            window.dispatchEvent(favoriteUpdateEvent);

            if (!isSelected) {
                // If role is being selected, increment usage by 1
                const increment = 1;
                // await updateUsage(department, role, increment);
            }

            if (isSelected && selectedCategory === 'Favorite') {
                await fetchFavoritedRoleMappings(); // Refresh favorited roles
            }
        } catch (error) {
            console.error(`Error ${isSelected ? 'removing' : 'adding'} role mapping:`, error);
            // Optionally, revert the selection state if the API call fails
            setSelectedRoles(isSelected ? [...newSelectedRoles, roleKey] : newSelectedRoles.filter((r) => r !== roleKey));
            toast.error('Failed to update role selection.');
        }
    };

    // Add near other useRef declarations
    const processingRoles = useRef<Set<string>>(new Set());

    const navigateToChat = async (role: string, department: string) => {
        const roleKey = `${department}:${role}`;

        // Prevent navigation during initial loading of roles
        if (isLoadingRoles) {
            return;
        }

        // Check if already processing this role
        if (processingRoles.current.has(roleKey)) {
            return;
        }

        // Mark as processing
        processingRoles.current.add(roleKey);

        try {
            if (!selectedRoles.includes(roleKey)) {
                await handleRoleSelect(role, department, true);
            }

            // Set the selected role name for display in expand bar
            setSelectedRoleName(role);

            router.push({
                pathname: '/ChatHome_bus',
                query: { selectedRole: role, selectedCategory: department },
            });
            setIsContentVisible(false);
        } finally {
            // Remove from processing
            processingRoles.current.delete(roleKey);
        }
    };

    // FIXED: handleRoleSelect function - shows toast immediately for user actions
    const handleRoleSelect = async (
        role: string,
        department: string,
        isImageClick: boolean = false
    ) => {
        // Prevent actions during initial loading of roles
        if (isLoadingRoles) {
            return;
        }

        if (!address) {
            toast.info('Please connect your wallet.');
            return;
        }

        const roleKey = `${department}:${role}`;
        const isSelected = selectedRoles.includes(roleKey);

        // Handle image click (add to favorites)
        if (isImageClick) {
            if (!isSelected) {
                // Add the role to selectedRoles immediately
                setSelectedRoles(prev => [...prev, roleKey]);

                // Show toast immediately for user action
                const selectedLocalizedMessage = await getLocalizedString('got selected', language);
                const localizedRole = await getLocalizedString(role, language);
                toast.success(`${localizedRole} ${selectedLocalizedMessage}`, { autoClose: 5000 });

                // Call add-role-mapping API
                try {
                    const response = await fetch('/api/add-role-mapping', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userAddress: address, department, role }),
                    });

                    if (!response.ok) {
                        throw new Error('Failed to add role mapping');
                    }

                    // Broadcast favorite update event
                    const favoriteUpdateEvent = new CustomEvent('favoriteRoleUpdated', {
                        detail: {
                            action: 'add',
                            role: { department, role },
                            userAddress: address,
                            timestamp: Date.now() // Add timestamp to ensure unique events
                        }
                    });
                    window.dispatchEvent(favoriteUpdateEvent);

                    // If adding to 'Favorited', refresh favorited roles
                    if (selectedCategory === 'Favorite') {
                        await fetchFavoritedRoleMappings();
                    }
                } catch (error) {
                    console.error(`Error adding role mapping:`, error);
                    // Revert selection if API call fails
                    setSelectedRoles(prev => prev.filter((r) => r !== roleKey));
                    toast.error('Failed to select role.');
                }
            }
            // If already selected, do nothing
            return;
        }

        // Prevent unselecting in 'Favorited' category
        if (isSelected && selectedCategory === 'Favorite') {
            return;
        }

        const newSelectedRoles = isSelected
            ? selectedRoles.filter((r) => r !== roleKey)
            : [...selectedRoles, roleKey];

        setSelectedRoles(newSelectedRoles);

        // Fetch localized messages
        const selectedLocalizedMessage = await getLocalizedString('got selected', language);
        const deselectedLocalizedMessage = await getLocalizedString('got deselected', language);
        const localizedRole = await getLocalizedString(role, language);

        // Show appropriate toast message only for user action
        if (isSelected) {
            toast.info(`${localizedRole} ${deselectedLocalizedMessage}`, { autoClose: 5000 });
        } else {
            toast.success(`${localizedRole} ${selectedLocalizedMessage}`, { autoClose: 5000 });
        }

        // Determine API endpoint based on selection state
        const endpoint = isSelected
            ? '/api/remove-role-mapping'
            : '/api/add-role-mapping';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: address, department, role }),
            });

            if (!response.ok) {
                throw new Error('Failed to update role mapping');
            }

            if (!isSelected) {
                // If role is being selected, increment usage by 1 (optional)
                // const increment = 1;
                // await updateUsage(department, role, increment);
            }

            if (isSelected && selectedCategory === 'Favorite') {
                await fetchFavoritedRoleMappings(); // Refresh favorited roles
            }
        } catch (error) {
            console.error(`Error ${isSelected ? 'removing' : 'adding'} role mapping:`, error);
            // Revert selection if API call fails
            setSelectedRoles(isSelected
                ? [...newSelectedRoles, roleKey]
                : newSelectedRoles.filter((r) => r !== roleKey)
            );
            toast.error('Failed to update role selection.');
        }
    };

    // Function to open the role description modal
    const openRoleDescription = async (role: string, department: string) => {
        setIsRoleModalOpen(true);
        setCurrentRoleDescription(''); // Reset previous description
        setCurrentRole('Persona Description: ' + role);
        try {
            const response = await fetch('/api/get_role_description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department,
                    role,
                    language: language, // Now defined
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch role description');
            }

            const data = await response.json();
            setCurrentRoleDescription(
                data.description // Use LocalizedText for localization
            );
        } catch (error) {
            console.error('Error fetching role description:', error);
            setCurrentRoleDescription('');
        }
    };

    // Function to close the role description modal
    const closeRoleModal = () => {
        setIsRoleModalOpen(false);
        setCurrentRoleDescription('');
        setActiveRoleButton(null);
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
                }
            };
            fetchChatRoles();
        }
    }, [selectedChatDepartment]);



    interface NFTBlockProps {
        role: string;
        department: string;
        roleKey: string;
        imageSrc: string;
        altText: string;
        price: string;
        rating: number;
        roleUsage: number;
        isSelected: boolean;
        handleRoleToggle: (role: string, department: string) => void;
        navigateToChat: (role: string, department: string) => void;
        openRoleDescription: (role: string, department: string) => void;
        styles: any; // You can make this more specific if you have a styles type
        getRoleSummary: (department: string, role: string) => string;
    }

    // Component for displaying role summary with LocalizedText

    const RoleSummaryOverlay: React.FC<{
        role: string;
        department: string;
        getRoleSummary: (department: string, role: string) => string;
    }> = ({ role, department, getRoleSummary }) => {
        const summary = getRoleSummary(department, role);

        return (
            <div className={styles.roleDescriptionOverlay}>
                {summary}
            </div>
        );
    };



    const NFTBlock: React.FC<NFTBlockProps> = ({
        role,
        department,
        roleKey,
        imageSrc,
        altText,
        price,
        rating,
        roleUsage,
        isSelected,
        handleRoleToggle,
        navigateToChat,
        openRoleDescription,
        styles
    }) => {
        return (
            <div style={{
                minWidth: '200px',
                maxWidth: '250px',
                height: 'auto',
                minHeight: '250px',
                maxHeight: '300px',
                backgroundColor: '#0f6190',
                borderRadius: '8px',
                padding: '8px',
                position: 'relative',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'center',
                cursor: 'pointer'
            }}>
                {/* Image Section */}
                <div
                    className={`${styles.nftImageWrapper} ${isSelected ? styles.selected : ''}`}
                    style={{
                        width: '100%',
                        borderRadius: '6px 6px 0 0',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        position: 'relative',
                        height: '200px', // Fixed reasonable height
                        flexShrink: 0
                    }}
                >
                    {/* Checkbox Overlay */}
                    <div className={styles.tooltipContainer} style={{ top: '4px', right: '4px' }}>
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                                e.stopPropagation();
                                handleRoleToggle(role, department);
                            }}
                            className={styles.roleCheckbox}
                            style={{
                                width: '12px',
                                height: '12px',
                                accentColor: isSelected ? '#ff4d4f' : '#ccc'
                            }}
                            aria-label={isSelected ? 'Uncheck to remove from favorites' : 'Check to add to favorites'}
                        />
                        <span className={styles.tooltipText}>
                            {isSelected ? 'Uncheck to remove from favorites' : 'Check to add to favorites'}
                        </span>
                    </div>

                    {/* Image */}
                    <img
                        src={imageSrc}
                        onClick={() => navigateToChat(role, department)}
                        alt={altText}
                        className={styles.nftImage}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '6px 6px 0 0',
                            cursor: 'pointer',
                            filter: isSelected ? 'brightness(1.1)' : 'brightness(1)',
                            transition: 'filter 0.3s ease',
                        }}
                    />

                    {/* Selection Indicator Badge */}


                    {/* Tooltip */}
                    <div className={styles.hoverTooltip}>
                        <LocalizedText name="Click image to start chatting" />
                    </div>

                    {/* Usage Count Overlay */}
                    <div className={styles.usageOverlay}>
                        <LocalizedText name="Usage" /> {roleUsage}
                    </div>

                    {/* Role Summary Overlay with LocalizedText */}
                    <RoleSummaryOverlay
                        role={role}
                        department={department}
                        getRoleSummary={getRoleSummary}
                    />

                </div>

                {/* INFO SECTION - This is what's missing in current version */}
                <div className={styles.nftInfo} style={{
                    padding: '8px 4px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    flexGrow: 1,
                    minHeight: '100px' // Ensure minimum space for content
                }}>
                    {/* Title Section */}
                    <div className={styles.nftNameWrapper}>
                        <AutoFitText
                            maxFontSize={19}
                            minFontSize={8}
                            maxLines={2}
                            className={styles.nftName}
                            onClick={() => openRoleDescription(role, department)}
                        >
                            <LocalizedText name={role} />
                        </AutoFitText>
                        <div className={styles.hoverTooltip}>
                            <LocalizedText name="Click to view this persona's description." />
                        </div>
                    </div>

                    {/* Rating and Price Section */}
                    <div className={styles.ratingAndAmount}>
                        {rating ? (
                            <>
                                <span className={styles.ratingValue}>
                                    <LocalizedText name="Rating" />: {rating.toFixed(1)}
                                </span>
                                <Rating value={Math.round(rating)} />
                                {price && (
                                    <span className={styles.sendAmount}>
                                        <LocalizedText name="Price" />: {price}
                                    </span>
                                )}
                            </>
                        ) : (
                            price && (
                                <div className={styles.centeredSendAmount}>
                                    <LocalizedText name="Price" />: {price}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        );
    };



    return (
        <div className={styles.shopContainer}>
            {/* Top Expand/Collapse Bar */}
            <div
                className={styles.shopToggleBar}
                onClick={() => {
                    if (roles.length > 0) setIsContentVisible((v) => !v);
                }}
                style={{
                    opacity: roles.length > 0 ? 1 : 0,
                    pointerEvents: roles.length > 0 ? 'auto' : 'none',
                    minHeight: '32px',
                    height: '32px',
                    maxHeight: '32px',
                    background: 'linear-gradient(90deg, #0f6190 0%, #0096FF 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#fff',
                    cursor: roles.length > 0 ? 'pointer' : 'default',
                    userSelect: 'none',
                    padding: '0 12px',
                    transition: 'background 0.2s, opacity 0.2s',
                }}
            >
                {/* Company Name (left) */}
                <span style={{
                    minWidth: 0,
                    flex: 1,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: 400
                }}>
                    {nameData.companyName || ''}
                </span>

                {/* Shop + Breadcrumb + Expand/Collapse */}
                <span style={{
                    flex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 0,
                    position: 'relative',
                    flexWrap: 'wrap',
                    gap: '4px'
                }}>
                    {/* 1) Core Shop Section */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        order: 1
                    }}>
                        <span style={{
                            marginRight: 6,
                            fontSize: '16px',
                            flexShrink: 0
                        }}>🛒</span>
                        <span style={{
                            fontWeight: 700,
                            fontSize: 'clamp(14px, 2.5vw, 17px)',
                            flexShrink: 0
                        }}>
                            <LocalizedText name="Shop" />
                        </span>
                    </div>

                    {/* 2) SINGLE Breadcrumb (old “→ Category → Role” style) */}
                    {(
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexShrink: 1,
                            minWidth: 0,
                            order: 2,
                            margin: '0 4px'
                        }}>
                            <span style={{
                                margin: '0 4px',
                                fontWeight: 500,
                                fontSize: '16px',
                                color: '#fff',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%',
                                transition: 'color 0.2s ease'
                            }}>
                                → <LocalizedText name={selectedCategory} />
                                {currentSelectedRole && (
                                    <> → <LocalizedText name={currentSelectedRole.role} /></>
                                )}
                            </span>
                        </div>
                    )}


                    {/* 3) Expand/Collapse Controls */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        order: 3,
                        marginLeft: 'auto'
                    }}>
                        {!isContentVisible ? (
                            // Collapsed state
                            <>
                                <span style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    lineHeight: '0.6',
                                    fontSize: 'clamp(11px, 1.5vw, 11px)',
                                    flexShrink: 0
                                }}>
                                    <span>▲</span>
                                    <p></p>
                                    <span>▼</span>
                                </span>
                                <span style={{
                                    fontSize: 'clamp(11px, 2vw, 14px)',
                                    fontWeight: 500,
                                    opacity: 0.9,
                                    whiteSpace: 'nowrap',
                                    display: window.innerWidth > 480 ? 'inline' : 'none'
                                }}>
                                    <LocalizedText name="Click to Expand" />
                                </span>
                            </>
                        ) : (
                            // Expanded state
                            <>
                                <span style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    lineHeight: '0.6',
                                    fontSize: 'clamp(11px, 1.5vw, 11px)',
                                    flexShrink: 0
                                }}>
                                    <span>▼</span>
                                    <p></p>
                                    <span>▲</span>
                                </span>
                                <span style={{
                                    fontSize: 'clamp(12px, 2.2vw, 15px)',
                                    fontWeight: 500,
                                    opacity: 0.9,
                                    whiteSpace: 'nowrap',
                                    display: window.innerWidth > 480 ? 'inline' : 'none'
                                }}>
                                    <LocalizedText name="Click to Collapse" />
                                </span>
                            </>
                        )}
                    </div>
                </span>

                {/* User Name (right) */}
                <span style={{
                    minWidth: 0,
                    flex: 1,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: 400
                }}>
                    {nameData.userName || ''}
                </span>
            </div>


            {/* Company Name & User Name Sub-Modals */}
            {showCompanyModal && (
                <div className={styles.subModalOverlay}>
                    <div className={styles.subModalContent}>
                        <h3>
                            <LocalizedText name="Please Enter Your Company Name" />
                        </h3>
                        {/* Input field for entering a new company name */}
                        <input
                            type="text"
                            value={tempCompanyName}
                            onChange={(e) => {
                                setTempCompanyName(e.target.value);
                                setIsDropdownSelection(false);
                            }}
                            placeholder="Enter company name"
                            className={styles.subModalInput}
                        />
                        <h3>
                            <LocalizedText name="Or Choose from below " />
                        </h3>
                        {/* Dropdown to select an existing company name */}
                        {companyNames.length > 0 && (
                            <div style={{ marginTop: "1rem" }}>
                                <label style={{
                                    display: "block",
                                    marginBottom: "0.5rem",
                                    color: "black"
                                }}>
                                    <LocalizedText name="Or choose from the list:" />
                                </label>
                                <select
                                    value={tempCompanyName}
                                    onChange={(e) => {
                                        setTempCompanyName(e.target.value);
                                        setIsDropdownSelection(true);
                                    }}
                                    style={{
                                        width: "100%",
                                        padding: "0.5rem",
                                        fontSize: "16px",
                                        borderRadius: "8px"
                                    }}
                                >
                                    <option value="">--Select Company--</option>
                                    {companyNames.map((name) => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <button
                            onClick={handleSetCompanyName}
                            className={styles.subModalButton}
                            style={{ marginTop: "1rem" }}
                        >
                            <LocalizedText name="Submit" />
                        </button>
                    </div>
                </div>
            )}

            {showUserModal && (
                <div className={styles.subModalOverlay}>
                    <div className={styles.subModalContent}>
                        <h3><LocalizedText name="Please Enter Your Name" /></h3>
                        <input
                            type="text"
                            value={tempUserName}
                            onChange={(e) => setTempUserName(e.target.value)}
                            placeholder="Enter your name"
                            className={styles.subModalInput}
                        />
                        <button onClick={handleSetUserName} className={styles.subModalButton}>
                            <LocalizedText name="Submit" />
                        </button>
                    </div>
                </div>
            )}



            {/* Shop Content - Flexbox Scrollable Layout */}
            {isContentVisible && roles.length > 0 && (
                <main
                    style={{
                        height: '67vh',
                        maxHeight: '67vh',
                        overflow: 'auto',
                        padding: '10px',
                        background: '#000',
                        scrollbarWidth: 'auto' // Make scrollbar more obvious
                    }}
                >
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        width: 'max-content', // Allow horizontal expansion
                        minWidth: '100%',
                        height: 'max-content',
                        minHeight: '100%'
                    }}>
                        {/* Row 1 */}
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            overflow: 'visible',
                            padding: '2px 0',
                            // minHeight: 'calc((67vh - 60px) / 2)', // Minimum height but allow expansion
                            height: 'auto', // Allow natural height
                            alignItems: 'flex-start' // Align to top instead of stretch
                        }}>
                            {roles.slice(0, Math.ceil(roles.length / 2)).map(({ department, role }) => {
                                const roleKey = `${department}:${role}`;
                                const imageSrc = imageMapping[roleKey];
                                const altText = role;
                                const price =
                                    roleMappings[department]?.find((mapping) => mapping.role === role)?.price ||
                                    favoritedRoleMappings.find((mapping) => mapping.role === role)?.price ||
                                    '';
                                const rating = ratings[roleKey] || 0;
                                const roleUsage = usage[roleKey] || 0;
                                const isSelected = selectedRoles.includes(roleKey);

                                return (
                                    <NFTBlock
                                        key={roleKey}
                                        role={role}
                                        department={department}
                                        roleKey={roleKey}
                                        imageSrc={imageSrc}
                                        altText={altText}
                                        price={price}
                                        rating={rating}
                                        roleUsage={roleUsage}
                                        isSelected={isSelected}
                                        handleRoleToggle={handleRoleToggle}
                                        navigateToChat={navigateToChat}
                                        openRoleDescription={openRoleDescription}
                                        styles={styles}
                                        getRoleSummary={getRoleSummary} // ADD: Missing prop
                                    />
                                );
                            })}
                        </div>

                        {/* Row 2 */}
                        <div style={{
                            display: 'flex',
                            gap: '8px',
                            overflow: 'visible',
                            padding: '5px 0',
                            //minHeight: 'calc((67vh - 60px) / 2)', // Minimum height but allow expansion
                            height: 'auto', // Allow natural height
                            alignItems: 'flex-start' // Align to top instead of stretch
                        }}>
                            {roles.slice(Math.ceil(roles.length / 2)).map(({ department, role }) => {
                                const roleKey = `${department}:${role}`;
                                const imageSrc = imageMapping[roleKey];
                                const altText = role;
                                const price =
                                    roleMappings[department]?.find((mapping) => mapping.role === role)?.price ||
                                    favoritedRoleMappings.find((mapping) => mapping.role === role)?.price ||
                                    '';
                                const rating = ratings[roleKey] || 0;
                                const roleUsage = usage[roleKey] || 0;
                                const isSelected = selectedRoles.includes(roleKey);

                                return (
                                    <NFTBlock
                                        key={roleKey}
                                        role={role}
                                        department={department}
                                        roleKey={roleKey}
                                        imageSrc={imageSrc}
                                        altText={altText}
                                        price={price}
                                        rating={rating}
                                        roleUsage={roleUsage}
                                        isSelected={isSelected}
                                        handleRoleToggle={handleRoleToggle}
                                        navigateToChat={navigateToChat}
                                        openRoleDescription={openRoleDescription}
                                        styles={styles}
                                        getRoleSummary={getRoleSummary} // ADD: Missing prop
                                    />
                                );
                            })}
                        </div>
                    </div>
                </main>
            )}


            {/* Role Description Modal */}
            {isRoleModalOpen && (
                <div className={styles.modalOverlay}>
                    <div
                        className={styles.modalContent}
                        style={{
                            top: roleModalPosition.top,
                            left: roleModalPosition.left,
                            backgroundColor: 'blue'
                        }}
                    >
                        <button className={styles.closeButton} onClick={closeRoleModal}>
                            X
                        </button>
                        {/* Center the currentRole in the modal */}
                        <h2
                            className={styles.modalTitle}
                            style={{
                                color: 'white',
                                textAlign: 'center',
                                marginBottom: '15px'
                            }}
                        >
                            <LocalizedText name={currentRole} />
                        </h2>
                        <p className={styles.modalDescription} style={{ color: 'white' }}>
                            {currentRoleDescription ? (
                                currentRoleDescription
                            ) : (
                                <LocalizedText name="Please wait, still loading...." />
                            )}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );

};

export default Shop;
// Disable static generation for these pages
export async function getServerSideProps() {
    return {
        props: {},
    };
}