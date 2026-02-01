import { useRouter } from 'next/router';
import { useEffect, useState, useCallback } from 'react';

interface RoleData {
    role: string;
    department: string;
    task?: string;
}

export const useURLRoleState = () => {
    const router = useRouter();
    const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
    const [isShopExpanded, setIsShopExpanded] = useState(true);

    // Sync URL params with state
    useEffect(() => {
        const { selectedRole: urlRole, selectedCategory, selectedTask } = router.query;

        if (urlRole) {
            const roleData: RoleData = {
                role: decodeURIComponent(urlRole as string),
                department: selectedCategory ? decodeURIComponent(selectedCategory as string) : 'Favorite',
                task: selectedTask ? decodeURIComponent(selectedTask as string) : ''
            };
            setSelectedRole(roleData);
            setIsShopExpanded(true); // Ensure shop is expanded when role is loaded from URL
        }
    }, [router.query]);

    const updateRoleInURL = useCallback((roleData: RoleData, expandShop: boolean = true) => {
        const query: any = {
            ...router.query,
            selectedRole: encodeURIComponent(roleData.role),
            selectedCategory: encodeURIComponent(roleData.department || 'Favorite'),
        };

        if (roleData.task) {
            query.selectedTask = encodeURIComponent(roleData.task);
        }

        setIsShopExpanded(expandShop);

        router.push({
            pathname: router.pathname,
            query
        }, undefined, { shallow: true });
    }, [router]);

    const clearRoleFromURL = useCallback(() => {
        const { selectedRole, selectedCategory, selectedTask, ...restQuery } = router.query;

        router.push({
            pathname: router.pathname,
            query: restQuery
        }, undefined, { shallow: true });

        setSelectedRole(null);
    }, [router]);

    return {
        selectedRole,
        updateRoleInURL,
        clearRoleFromURL,
        isShopExpanded,
        setIsShopExpanded
    };
};
