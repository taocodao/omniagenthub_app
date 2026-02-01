// contexts/MarketingChatModalContext.tsx
import React, { createContext, useState, ReactNode } from 'react';
import MarketingChatModal from '../components/MarketingChatModal';

interface MarketingChatModalContextProps {
    openChat: () => void;
    closeChat: () => void;
    openBusinessChat: () => void;
}

export const MarketingChatModalContext = createContext<MarketingChatModalContextProps>({
    openChat: () => { },
    closeChat: () => { },
    openBusinessChat: () => { },
});

interface MarketingChatModalProviderProps {
    children: ReactNode;
}

export const MarketingChatModalProvider: React.FC<MarketingChatModalProviderProps> = ({ children }) => {
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [isBusinessMode, setIsBusinessMode] = useState(false);

    const openChat = () => {
        setIsBusinessMode(false);
        setIsChatModalOpen(true);
    };

    const openBusinessChat = () => {
        setIsBusinessMode(true);
        setIsChatModalOpen(true);
    };

    const closeChat = () => {
        console.log('Closing marketing/business chat modal');
        setIsChatModalOpen(false);
        setIsBusinessMode(false);
    };

    return (
        <MarketingChatModalContext.Provider value={{ openChat, closeChat, openBusinessChat }}>
            {children}
            {isChatModalOpen && (
                <MarketingChatModal
                    isOpen={!isBusinessMode}
                    onClose={closeChat}
                />
            )}
        </MarketingChatModalContext.Provider>
    );
};
