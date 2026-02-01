/* eslint-disable react-hooks/exhaustive-deps */
// pages/ChatHome_new.tsx

import React, { useState, useEffect, useCallback } from 'react';
//import { useActiveAccount } from '../hooks/useWalletAddress';
import { useActiveAccount } from '../hooks/useWalletAddress';
import { useRouter } from 'next/router';
import SignIn from '../components/SignIn';
import Navbar from '../components/Navbar_Business';
import Shop from '../pages/shop_business';
import ChatHome from './ChatHome_Business';
import styles from '../styles/ChatHomeNew.module.css';
import { eventBus, EVENT_TYPES, RoleEventData } from '../utils/eventBus';

const ChatHomeNew: React.FC = () => {
    // Enhanced interface to support department and other properties
    interface RoleData {
        role: string;
        department?: string;
        task?: string;
    }

    const { account, isLoading } = useActiveAccount() || {};
    const address = account?.address;
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState('Favorite');
    const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
    const [isShopExpanded, setIsShopExpanded] = useState(true);
    const [isUrlRoleSet, setIsUrlRoleSet] = useState(false); // ✅ Add this line
    const [eventSelectedRole, setEventSelectedRole] = useState<RoleEventData | null>(null);
    const [breadcrumb, setBreadcrumb] = useState<string>('');
    // Handle URL parameters on component mount and route changes
    useEffect(() => {
        const handleURLParameters = () => {
            const { selectedRole: urlRole, selectedCategory: urlCategory, selectedTask } = router.query;

            if (urlRole) {
                const roleData: RoleEventData = {
                    role: decodeURIComponent(urlRole as string),
                    department: urlCategory ? decodeURIComponent(urlCategory as string) : 'Favorite',
                    task: selectedTask ? decodeURIComponent(selectedTask as string) : '',
                    source: 'url'
                };

                console.log('URL role detected:', roleData);

                // Update local state
                setSelectedRole(roleData);
                setIsShopExpanded(false);
                setIsUrlRoleSet(true);  // ✅ Add this line

                // Update category if provided in URL
                if (urlCategory) {
                    setSelectedCategory(decodeURIComponent(urlCategory as string));
                }

                if (window.setSelectedRole) {
                    //      window.setSelectedRole(decodeURIComponent(urlRole as string));
                }

                // Ensure department is set for dropdown selections
                const processedRoleData = {
                    ...roleData,
                    department: roleData.department || 'Favorite'
                };

                setEventSelectedRole(processedRoleData);

                // Emit event for shop_marketing.tsx to listen
                eventBus.emit(EVENT_TYPES.ROLE_FROM_URL, processedRoleData);
                // Force re-render of expand pane

            }
        };

        // Check URL on mount and route changes
        handleURLParameters();
    }, [router.query]);

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

    // Show loading spinner while Privy initializes session from localStorage
    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                flexDirection: 'column',
                gap: '20px',
                backgroundColor: '#0a0a0a',
            }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    border: '5px solid #333',
                    borderTop: '5px solid #3498db',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                }}></div>
                <div style={{ color: '#fff' }}>Loading...</div>
                <style jsx>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

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

                        {/* ChatHome Business section */}
                        <div className={styles.chatSection}>
                            <ChatHome
                                parentSelectedRole={selectedRole?.role}
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
