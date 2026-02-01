import { useState, useEffect } from "react";
import styles from "../styles/Home1.module.css";
//import { useDisconnect } from "@thirdweb-dev/react";


const Connected = ({ smartWalletAddress }: { smartWalletAddress: string }) => {
    const [usernameInput, setUsernameInput] = useState<string>("");
    const [isRegisteringUsername, setIsRegisteringUsername] = useState<boolean>(false);
    const [hasUsername, setHasUsername] = useState<boolean>(false);
    const [usernameOfAccount, setUsernameOfAccount] = useState<string | null>(null);
    // const disconnect = useDisconnect(); // Initialize disconnect function
    useEffect(() => {
        const checkUsername = async () => {
            const response = await fetch('/api/userNameAccount', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ smartWalletAddress: smartWalletAddress }),
            });

            const data = await response.json();
            if (response.status === 200) {
                setUsernameOfAccount(data.username);
                setHasUsername(true);
            }
        };

        checkUsername();
    }, [smartWalletAddress]);

    const handleCreateUsername = async () => {
        if (!usernameInput) {
            alert("Please enter a username");
            return;
        }

        try {
            const response = await fetch('/api/userNameAccount', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ smartWalletAddress: smartWalletAddress, username: usernameInput }),
            });

            if (response.status === 201) {
                setUsernameOfAccount(usernameInput);
                setHasUsername(true);
            } else if (response.status === 409) {
                alert("Username already taken. Please choose another one.");
            }
        } catch (error) {
            console.log("Error registering username:", error);
        }
    };

    if (!hasUsername) {
        return (
            <div className={styles.bgContainer}>
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    width: "80%",
                    height: "auto",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    padding: "2rem",
                    backgroundColor: "#151515",
                }}>
                    <h1>Username not registered</h1>
                    <p>Please create a username to start using the app.</p>
                    <input
                        type="text"
                        placeholder="Username"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className={styles.input}
                    />
                    <button
                        onClick={handleCreateUsername}
                        disabled={isRegisteringUsername}
                        className={styles.button}
                    >{isRegisteringUsername ? "Registering username..." : "Register username"}</button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.appCard}>
            <div style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
            }}>
                <h1>Welcome {usernameOfAccount}</h1>
                <button
                    onClick={async () => {
                        //await disconnect();
                    }}
                    className={styles.secondaryButton}
                >Sign Out</button>
            </div>
            {/* Additional user-related components can be added here */}
        </div>
    );
};

export default Connected;
