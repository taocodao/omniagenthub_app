import { useState, useEffect } from 'react';
import { useActiveAccount } from '../hooks/useWalletAddress'; // Correct hook to use

const useShowConnectEmbed = () => {
    const activeAccount = useActiveAccount();
    const [showConnectEmbed, setShowConnectEmbed] = useState(false);

    useEffect(() => {
        // Show Connect Embed if the user is not authenticated (no address)
        setShowConnectEmbed(!activeAccount);
    }, [activeAccount]);

    return showConnectEmbed;
};

export default useShowConnectEmbed;
