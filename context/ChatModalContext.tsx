// contexts/ChatModalContext.tsx

import React, { createContext, useState, ReactNode } from 'react';
import ChatModal from '../components/ChatModal';

interface ChatModalContextProps {
    openChat: () => void;
    closeChat: () => void;
}

export const ChatModalContext = createContext<ChatModalContextProps>({
    openChat: () => { },
    closeChat: () => { },
});

interface ChatModalProviderProps {
    children: ReactNode;
}

export const ChatModalProvider: React.FC<ChatModalProviderProps> = ({ children }) => {
    const [isChatModalOpen, setIsChatModalOpen] = useState<boolean>(false);

    const openChat = () => setIsChatModalOpen(true);
    const closeChat = () => setIsChatModalOpen(false);

    return (
        <ChatModalContext.Provider value={{ openChat, closeChat }}>
            {children}
            <ChatModal isOpen={isChatModalOpen} onClose={closeChat} />
        </ChatModalContext.Provider>
    );
};
