// contexts/BusinessChatModalContext.tsx
import React, { createContext, useState, ReactNode } from 'react';
import GuidedDiscoveryChatModal from '../components/GuidedDiscoveryChatModal';

interface BusinessChatModalContextProps {
    openChat: () => void;
    closeChat: () => void;
}

export const BusinessChatModalContext = createContext<BusinessChatModalContextProps>({
    openChat: () => { },
    closeChat: () => { },
});

interface BusinessChatModalProviderProps {
    children: ReactNode;
}

export const BusinessChatModalProvider: React.FC<BusinessChatModalProviderProps> = ({ children }) => {
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);

    const openChat = () => {
        console.log('Opening business chat modal (using MarketingChatModal in business mode)');
        setIsChatModalOpen(true);
    };

    const closeChat = () => {
        console.log('Closing business chat modal');
        setIsChatModalOpen(false);
    };

    return (
        <BusinessChatModalContext.Provider value={{ openChat, closeChat }}>
            {children}
            {/* Use MarketingChatModal with isOpen={false} for business mode and external visibility control */}
            <GuidedDiscoveryChatModal
                isOpen={false}
                onClose={closeChat}
                externalVisibility={isChatModalOpen}
            />
        </BusinessChatModalContext.Provider>
    );
};
