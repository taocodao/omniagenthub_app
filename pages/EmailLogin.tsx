import { useState } from "react";

import { getAllAdmins, getAccountsOfSigner } from "thirdweb/extensions/erc4337";
import { smartWallet } from "thirdweb/wallets";
import styles from "../styles/Home.module.css";
import { ACCOUNT_FACTORY_ADDRESS, ACTIVE_CHAIN } from "../constants/constants";
import { client } from "../util/client";
import { polygonAmoy, polygon, Chain } from "thirdweb/chains";
import { useActiveWallet, useActiveAccount, useConnectedWallets } from "thirdweb/react";
import {
    inAppWallet,
    preAuthenticate,
} from "thirdweb/wallets/in-app";

const smartWalletConfig = {
    factoryAddress: ACCOUNT_FACTORY_ADDRESS,
    gasless: true,
};


//export default function EmailSignIn() {
export default function EmailSignIn({ onAccountConnected }: { onAccountConnected: (wallet: any, address: string) => void }) {
    const [state, setState] = useState<
        "init" | "sending_email" | "email_verification" | "connected"
    >("init");
    const [email, setEmail] = useState<string>("");
    const [verificationCode, setVerificationCode] = useState<string>("");

    //const sendVerificationEmail = useEmbeddedWalletSendVerificationEmail();
    //const { login } = useLogin();
    //const connect = useConnect();

    // Define the mapping from string to Chain
    const chainMap: { [key: string]: Chain } = {
        "polygon-amoy-testnet": polygonAmoy,
        polygon: polygon, // Add Polygon mainnet
    };

    // Ensure activeChain is a Chain object
    const activeChain1: Chain = chainMap[ACTIVE_CHAIN];

    const handleEmailEntered = async () => {
        if (!email) {
            alert("Please enter an email");
            return;
        }
        setState("sending_email");
        try {
            await preAuthenticate({
                client, strategy: "email",
                email: email,
            });
            console.log("send out verification Email");
            setState("email_verification");
        } catch (error) {
            console.log("Error sending verification email:", error);
            alert("Failed to send verification email. Please try again.");
            setState("init");
        }
    };


    const handleEmailVerification = async () => {
        if (!verificationCode) {
            alert("Please enter the verification code");
            return;
        }

        try {
            console.log("Starting email verification...");

            // Step 1: Initialize the admin wallet (in-app wallet)
            const adminWallet = inAppWallet();

            // Step 2: Connect the in-app wallet using email verification
            const account = await adminWallet.connect({
                client,
                chain: activeChain1,
                strategy: "email",
                email: email,
                verificationCode: verificationCode,
            });

            const accountAddress = account.address;
            console.log("Connected in-app wallet address:", accountAddress);

            // Step 3: Initialize the smart wallet
            const wallet = smartWallet({
                chain: activeChain1,
                sponsorGas: true,
                factoryAddress: ACCOUNT_FACTORY_ADDRESS,
            });

            // Step 4: Connect the smart wallet with the personal account (adminWallet)
            await wallet.connect({
                client,
                personalAccount: account,
            });

            const smartWalletAddress = wallet.getAccount()?.address;
            console.log("Smart wallet address:", smartWalletAddress);

            if (!smartWalletAddress) {
                throw new Error("Failed to retrieve the smart wallet address.");
            }
            // Pass the smartWalletAddress to the onAccountConnected callback
            onAccountConnected(wallet, smartWalletAddress);

            // Optionally return the address if needed
            return smartWalletAddress;


        } catch (error) {
            console.error("Error during verification:", error);
            alert("Verification failed: " + error || "Unknown error");
            setState("init");
        }
    };


    if (state === "sending_email") {
        return <div><p>Sending OTP email...</p></div>;
    }

    if (state === "email_verification") {
        return (
            <div className={styles.bgContainer}>
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "flex-start",
                    width: "50%",
                    height: "auto",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    padding: "2rem",
                    backgroundColor: "#151515",
                }}>
                    <h3>Enter the verification code sent to your email</h3>
                    <input
                        placeholder="Enter verification code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        style={{
                            width: "100%",
                            height: "42px",
                            marginBottom: "1rem",
                            border: "1px solid #CCC",
                            borderRadius: "8px",
                            padding: "0.5rem 1rem"
                        }}
                    />
                    <button
                        className={styles.emailSignInBtn}
                        onClick={handleEmailVerification}
                        style={{
                            width: "100%",
                            height: "42px",
                            marginBottom: "1rem",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "RoyalBlue",
                            color: "#FFF",
                            border: "1px solid RoyalBlue",
                            borderRadius: "8px",
                        }}
                    >
                        Verify
                    </button>
                    <a onClick={() => setState("init")}>
                        <p style={{ color: "royalblue", cursor: "pointer", textAlign: "center" }}>Go Back</p>
                    </a>
                </div>
            </div>
        );
    }


    return (
        <div className={styles.bgContainer}>
            <div style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "flex-start",
                width: "50%",
                height: "auto",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "2rem",
                backgroundColor: "#151515",
            }}>
                <h1>Sign In</h1>
                <input
                    type="text"
                    style={{
                        width: "100%",
                        height: "42px",
                        marginBottom: "1rem",
                        border: "1px solid #CCC",
                        borderRadius: "8px",
                        padding: "0.5rem 1rem"
                    }}
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <button
                    className={styles.emailSignInBtn}
                    style={{
                        width: "100%",
                        height: "42px",
                        marginBottom: "1rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "RoyalBlue",
                        color: "#FFF",
                        border: "1px solid RoyalBlue",
                        borderRadius: "8px",
                    }}
                    onClick={handleEmailEntered}
                >Sign In</button>
            </div>
        </div>
    );
}