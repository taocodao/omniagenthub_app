// src/types/global.d.ts
export { };

declare global {
    interface Window {
        setSelectedRole?: (roleName: string) => void;
        setSelectedRoleInChat?: (roleName: string) => void;
        onCategoryChange?: (category: string) => void;
        onRoleClick?: () => void;
        setIsShopExpanded?: (expanded: boolean) => void;
        getSelectedCategory?: () => string;
        getIsShopExpanded?: () => boolean;
    }
}
