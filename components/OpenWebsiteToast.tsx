// components/OpenWebsiteToast.tsx

import React from 'react';
import styles from "../styles/OpenWebsiteToast.module.css"; // Ensure this CSS module exists

interface OpenWebsiteToastProps {
    onOpen: () => void;
}

const OpenWebsiteToast: React.FC<OpenWebsiteToastProps> = ({ onOpen }) => (
    <div className={styles.toastContainer}>
        <p>Would you like to open our website in a new tab to learn more?</p>
        {/* <p>Would you like to watch an introduction video to learn more about Web3AIStore and how it works?</p> */}
        <button onClick={onOpen} className={styles.okButton} aria-label="Open website in a new tab">
            OK
        </button>
    </div>
);

export default OpenWebsiteToast;
