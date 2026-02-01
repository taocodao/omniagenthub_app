// pages/ChatHome_new.tsx

import React, { useState, useEffect, useCallback } from 'react';
//import { useActiveAccount } from '../hooks/useWalletAddress';
import { useActiveAccount } from '../hooks/useWalletAddress';
import { useRouter } from 'next/router';
import SignIn from '../components/SignIn';
import Navbar from '../components/Navbar_marketing';
import Shop from '../pages/shop_marketing';
import ChatHomeMarketing from './ChatHome_marketing';
import styles from '../styles/ChatHomeNew.module.css';
import { eventBus, EVENT_TYPES, RoleEventData } from '../utils/eventBus';

const ChatHomeNew: React.FC = () => {
    // Enhanced interface to support department and other properties
    interface RoleData {
        role: string;
        department?: string;
        task?: string;
    }

    const address = useActiveAccount()?.account?.address;
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState('Favorite');
    const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
    const [isShopExpanded, setIsShopExpanded] = useState(true);
    const [isUrlRoleSet, setIsUrlRoleSet] = useState(false); // ✅ Add this line 
    // Handle URL parameters on component mount and route changes
    // Handle URL parameters on component mount and route changes
    // Handle URL parameters on component mount and route changes
    const [eventSelectedRole, setEventSelectedRole] = useState<RoleEventData | null>(null);
    useEffect(() => {
        const handleURLParameters = () => {
            // Check router.query first, but fallback to window.location for immediate access on mount
            let urlRole = router.query.selectedRole as string;
            let urlCategory = router.query.selectedCategory as string;
            let selectedTask = router.query.selectedTask as string;

            // If router query is not ready yet, try parsing window location directly
            if (!urlRole && typeof window !== 'undefined') {
                const searchParams = new URLSearchParams(window.location.search);
                urlRole = searchParams.get('selectedRole') || '';
                urlCategory = searchParams.get('selectedCategory') || '';
                selectedTask = searchParams.get('selectedTask') || '';
            }

            if (urlRole) {
                const roleData: RoleEventData = {
                    role: decodeURIComponent(urlRole),
                    department: urlCategory ? decodeURIComponent(urlCategory) : 'Favorite',
                    task: selectedTask ? decodeURIComponent(selectedTask) : '',
                    source: 'url'
                };

                console.log('URL role detected:', roleData);

                // Update local state FIRST
                setSelectedRole(roleData);
                setIsShopExpanded(false);
                setIsUrlRoleSet(true);

                // Update category if provided in URL
                if (urlCategory) {
                    setSelectedCategory(decodeURIComponent(urlCategory));
                }

                // Create processed role data with proper department
                const processedRoleData = {
                    ...roleData,
                    department: roleData.department || 'Favorite'
                };

                // Set event selected role for shop component
                setEventSelectedRole(processedRoleData);

                // Emit event for shop component to listen
                eventBus.emit(EVENT_TYPES.ROLE_FROM_URL, roleData);
            }
        };

        handleURLParameters();
    }, [router.query, router.isReady]); // Add router.isReady dependency

    // Handle category change from Navbar
    useEffect(() => {
        window.onCategoryChange = (category: string) => {
            setSelectedCategory(category);
            setIsShopExpanded(true);
            setSelectedRole(null); // Clear selected role when category changes

            // Emit category change event
            eventBus.emit(EVENT_TYPES.CATEGORY_CHANGED, { category });

        };

        window.onRoleClick = () => {
            setIsShopExpanded(!isShopExpanded);
        };

        window.setSelectedRole = (roleName: string) => {
            const roleData = { role: roleName, department: selectedCategory };
            setSelectedRole(roleData);

            // Emit event for consistency
            eventBus.emit(EVENT_TYPES.ROLE_SELECTED, {
                ...roleData,
                source: 'window'
            });
        };

        window.setIsShopExpanded = (expanded: boolean) => {
            setIsShopExpanded(expanded);
        };

        return () => {
            delete window.onCategoryChange;
            delete window.onRoleClick;
            delete window.setSelectedRole;
            delete window.setIsShopExpanded;
        };
    }, [isShopExpanded, selectedCategory]);





    // Handle role selection from Shop (image clicks)
    const handleRoleSelect = useCallback((role: any) => {
        console.log('Role selected from Shop image:', role);
        const roleWithDept = {
            ...role,
            department: selectedCategory || 'Favorite'
        };
        setSelectedRole(roleWithDept);
        setIsShopExpanded(false); // Collapse shop when role is selected from image

        // Emit event for shop_marketing.tsx and other components
        eventBus.emit(EVENT_TYPES.ROLE_SELECTED, {
            ...role,
            source: 'image'
        });
    }, []);

    /* const handleRoleSelect = useCallback((role: any) => {
         setSelectedRole(role);
         setIsShopExpanded(false);
         eventBus.emit(EVENT_TYPES.ROLE_SELECTED, { ...role, source: 'image' });
     }, []);*/


    // Handle dropdown role selection
    // Handle dropdown role selection
    const handleDropdownRoleSelect = useCallback((role: any) => {
        console.log('Role selected from dropdown:', role);

        // ✅ FIXED: Preserve the original department from role data
        const roleWithDepartment = {
            ...role,
            department: role.department || 'Favorite' // Use original department, fallback to Favorite only if none exists
        };

        // ✅ FIXED: Set category to the role's original department instead of forcing 'Favorite'
        setSelectedCategory(role.department || 'Favorite');
        setSelectedRole(roleWithDepartment);
        setIsShopExpanded(false); // Keep shop expanded when selecting from dropdown

        // Emit event for shop_marketing.tsx to listen
        eventBus.emit(EVENT_TYPES.ROLE_SELECTED, {
            ...roleWithDepartment, // ✅ Now preserves original department
            source: 'dropdown'
        });
    }, []);



    // Add debugging for event flow
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const debugHandler = (eventData: any) => {
                console.log('🚌 Event Bus Debug:', {
                    event: 'ROLE_SELECTED',
                    data: eventData,
                    currentState: {
                        selectedRole,
                        selectedCategory,
                        isShopExpanded
                    }
                });
            };

            eventBus.on(EVENT_TYPES.ROLE_SELECTED, debugHandler);

            return () => {
                eventBus.off(EVENT_TYPES.ROLE_SELECTED, debugHandler);
            };
        }
    }, [selectedRole, selectedCategory, isShopExpanded]);


    // Listen for events from other components
    useEffect(() => {
        const handleRoleSelected = (roleData: RoleEventData) => {
            console.log('Parent heard role selection:', roleData);
            setSelectedRole(roleData);

            // Keep shop expanded for dropdown and URL selections
            if (roleData.source === 'dropdown' || roleData.source === 'url') {
                setIsShopExpanded(false);
            } else if (roleData.source === 'image') {
                setIsShopExpanded(false);
            }
        };

        const handleShopExpansion = (data: any) => {
            console.log('Parent heard shop expansion request:', data);
            setIsShopExpanded(true);
        };

        const handleCategoryChange = (data: any) => {
            console.log('Parent heard category change:', data);
            setSelectedCategory(data.category);
        };

        // Subscribe to events
        eventBus.on(EVENT_TYPES.ROLE_SELECTED, handleRoleSelected);
        eventBus.on(EVENT_TYPES.ROLE_FROM_URL, handleRoleSelected);
        eventBus.on(EVENT_TYPES.SHOP_EXPANDED, handleShopExpansion);
        eventBus.on(EVENT_TYPES.CATEGORY_CHANGED, handleCategoryChange);

        return () => {
            // Cleanup event listeners
            eventBus.off(EVENT_TYPES.ROLE_SELECTED, handleRoleSelected);
            eventBus.off(EVENT_TYPES.ROLE_FROM_URL, handleRoleSelected);
            eventBus.off(EVENT_TYPES.SHOP_EXPANDED, handleShopExpansion);
            eventBus.off(EVENT_TYPES.CATEGORY_CHANGED, handleCategoryChange);
        };
    }, []);

    return (
        <div className={styles.container}>
            {!address ? (
                <SignIn />
            ) : (
                <>
                    {/* Navbar at the top */}
                    <Navbar isMarketingPage={true} />

                    {/* Main content area */}
                    <div className={styles.mainContent}>
                        {/* Shop section */}
                        <div className={`${styles.shopSection} ${isShopExpanded ? styles.expanded : styles.collapsed}`}>
                            <Shop
                                selectedCategory={selectedCategory}
                                isExpanded={isShopExpanded}
                                onRoleSelect={handleRoleSelect}
                                selectedRole={selectedRole}
                                isRoleFromURL={isUrlRoleSet}  // ✅ Add this prop
                            />
                        </div>

                        {/* ChatHome Marketing section */}
                        <div className={styles.chatSection}>
                            <ChatHomeMarketing
                                parentSelectedRole={selectedRole}
                                isShopExpanded={isShopExpanded}
                                onDropdownRoleSelect={handleDropdownRoleSelect}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ChatHomeNew;
