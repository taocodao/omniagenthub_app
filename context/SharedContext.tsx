// context/SharedContext.tsx

// biome-ignore lint/style/useImportType: <explanation>
import { createContext, useContext, useState, Dispatch, SetStateAction, ReactNode } from "react";

interface SharedContextType {
    freeChatsLeft: number | null;
    setFreeChatsLeft: Dispatch<SetStateAction<number | null>>;
    balanceData: string | null;
    setBalanceData: Dispatch<SetStateAction<string | null>>;
    freeUploadsLeft: number | null;
    setFreeUploadsLeft: Dispatch<SetStateAction<number | null>>;
    freeWebScrapeLeft: number | null;
    setFreeWebScrapeLeft: Dispatch<SetStateAction<number | null>>;
    selectedToken: 'USD' | 'MATIC';
    setSelectedToken: Dispatch<SetStateAction<'USD' | 'MATIC'>>;
    webaiBalance: string;
    setWebaiBalance: Dispatch<SetStateAction<string>>;
    maticBalance: string;
    setMaticBalance: Dispatch<SetStateAction<string>>;
}

const SharedContext = createContext<SharedContextType | undefined>(undefined);

const useSharedContext = () => {
    const context = useContext(SharedContext);
    if (!context) {
        throw new Error("useSharedContext must be used within a SharedProvider");
    }
    return context;
};

const SharedProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [freeChatsLeft, setFreeChatsLeft] = useState<number | null>(null);
    const [balanceData, setBalanceData] = useState<string | null>(null); // Existing state for balance
    const [freeUploadsLeft, setFreeUploadsLeft] = useState<number | null>(null); // New state for Free Uploads
    const [freeWebScrapeLeft, setFreeWebScrapeLeft] = useState<number | null>(null); // New state for Free CustomGPTs
    const [selectedToken, setSelectedToken] = useState<'USD' | 'MATIC'>('USD'); // New state for selectedToken
    const [webaiBalance, setWebaiBalance] = useState<string>('0.000'); // New state for WEBAI balance
    const [maticBalance, setMaticBalance] = useState<string>('0.000'); // New state for MATIC balance

    return (
        <SharedContext.Provider
            value={{
                freeChatsLeft,
                setFreeChatsLeft,
                balanceData,
                setBalanceData,
                freeUploadsLeft,
                setFreeUploadsLeft,
                freeWebScrapeLeft,
                setFreeWebScrapeLeft,
                selectedToken,
                setSelectedToken,
                webaiBalance,
                setWebaiBalance,
                maticBalance,
                setMaticBalance,
            }}
        >
            {children}
        </SharedContext.Provider>
    );
};

export { SharedProvider, useSharedContext };
