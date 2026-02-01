// pages/SignIn.tsx            
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
    ConnectEmbed,
    darkTheme,
    useActiveWallet,
} from "thirdweb/react";
import {
    getUserEmail
} from "thirdweb/wallets/in-app";
import { inAppWallet } from "thirdweb/wallets";
import { polygon, polygonAmoy, Chain } from "thirdweb/chains";
import { client } from "../util/client";
import {
    ACTIVE_CHAIN,
    ACCOUNT_FACTORY_ADDRESS,
} from "../constants/constants";
import styles from "../styles/Signin_new.module.css";

/* ------------------ theme ------------------ */
const customTheme = darkTheme({ colors: { modalBg: "#1a1a1a" } });

/* ------------------ chain configuration ------------------ */
const chainMap: Record<string, Chain> = {
    "polygon-amoy-testnet": polygonAmoy,
    polygon,
};
const activeChain = chainMap[ACTIVE_CHAIN];

/* ------------------ main page -------------- */
const SignInPage: React.FC = () => {
    const router = useRouter();
    const [emailCaptured, setEmailCaptured] = useState(false);
    const websiteUrl = router.query.url as string;

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '20px',
                padding: '40px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                textAlign: 'center'
            }}>
                {/* Header Section */}
                <div style={{ marginBottom: '30px' }}>
                    <h1 style={{
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: '#2c3e50',
                        marginBottom: '10px'
                    }}>
                        🤖 Welcome to AI Chat
                    </h1>
                    <p style={{
                        fontSize: '18px',
                        color: '#7f8c8d',
                        lineHeight: '1.6',
                        marginBottom: '20px'
                    }}>
                        Your intelligent website assistant
                    </p>
                </div>

                {/* Description Section */}
                <div style={{
                    background: '#f8f9fa',
                    padding: '25px',
                    borderRadius: '12px',
                    marginBottom: '30px',
                    textAlign: 'left'
                }}>
                    <h3 style={{
                        color: '#2c3e50',
                        marginBottom: '15px',
                        fontSize: '20px'
                    }}>
                        🚀 What you can do:
                    </h3>
                    <ul style={{
                        color: '#34495e',
                        lineHeight: '1.8',
                        paddingLeft: '20px',
                        margin: '0'
                    }}>
                        <li><strong>Ask questions</strong> about {websiteUrl ? new URL(websiteUrl).hostname : 'the website'}</li>
                        <li><strong>Get instant answers</strong> from website content</li>
                        <li><strong>Explore features</strong> and find information quickly</li>
                        <li><strong>Chat naturally</strong> with our AI assistant</li>
                    </ul>

                    <div style={{
                        marginTop: '20px',
                        padding: '15px',
                        background: '#e8f5e8',
                        borderRadius: '8px',
                        borderLeft: '4px solid #27ae60'
                    }}>
                        <p style={{
                            margin: '0',
                            color: '#27ae60',
                            fontWeight: 'bold',
                            fontSize: '14px'
                        }}>
                            🔒 Secure login with wallet authentication
                        </p>
                    </div>
                </div>

                {/* Connect Embed */}
                <ConnectEmbed
                    client={client}
                    accountAbstraction={{
                        chain: activeChain,
                        sponsorGas: true,
                        factoryAddress: ACCOUNT_FACTORY_ADDRESS,
                    }}
                    theme={customTheme}
                    className={styles.connectEmbed}
                    wallets={[
                        inAppWallet({
                            auth: {
                                options: ["email", "google", "apple", "facebook", "phone"],
                            },
                        }),
                    ]}
                    showThirdwebBranding={false}
                />

                {/* Email capture */}
                <EmailCapture onEmailCaptured={() => setEmailCaptured(true)} />

                {emailCaptured && (
                    <div style={{
                        marginTop: '20px',
                        padding: '15px',
                        background: '#d4edda',
                        color: '#155724',
                        borderRadius: '8px',
                        fontWeight: 'bold'
                    }}>
                        ✅ Successfully signed in! Starting chat session...
                    </div>
                )}

                {/* Footer */}
                <div style={{
                    marginTop: '30px',
                    fontSize: '14px',
                    color: '#95a5a6'
                }}>
                    Powered by Web3AIstore • AI-driven conversations
                </div>
            </div>
        </div>
    );
};

/* ------------------ helper types ----------- */
interface EmailCaptureProps {
    onEmailCaptured: () => void;
}

/* ------------------ ENHANCED email capture ----------- */
const EmailCapture: React.FC<EmailCaptureProps> = ({ onEmailCaptured }) => {
    const wallet = useActiveWallet();
    const router = useRouter();
    const [processed, setProcessed] = useState(false);

    useEffect(() => {
        if (!wallet || processed) return;

        (async (): Promise<void> => {
            try {
                console.log("🔍 Wallet connected, attempting to capture email…");

                await new Promise((res) => setTimeout(res, 1_000));

                const directEmail = await getUserEmail({ client });
                const finalEmail = directEmail || null;
                const walletAddress = wallet.getAccount()?.address ?? "unknown";

                console.log("=".repeat(45));
                console.log("📧 EMAIL       :", finalEmail ?? "N/A");
                console.log("🔗 WALLET      :", walletAddress);
                console.log("📅 TIMESTAMP   :", new Date().toISOString());
                console.log("🔐 AUTH METHOD :", wallet.id);
                console.log("🔗 CHAIN       :", activeChain?.name ?? "unknown");
                console.log("🏭 FACTORY     :", ACCOUNT_FACTORY_ADDRESS ?? "not-set");
                console.log("=".repeat(45));

                /* ✅ POST to /api/save-user-email if email is captured */
                if (finalEmail) {
                    try {
                        const websiteUrl = router.query.url as string | undefined;
                        console.log("💾 Saving email to database...");

                        const saveResponse = await fetch('/api/save-user-email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                email: finalEmail,
                                walletAddress: walletAddress,
                                websiteUrl: websiteUrl || '',
                                chainUsed: activeChain?.name,
                                factoryAddress: ACCOUNT_FACTORY_ADDRESS
                            }),
                        });

                        const saveResult = await saveResponse.json();
                        if (saveResponse.ok) {
                            console.log("✅ Email saved successfully:", saveResult.message);
                        } else {
                            console.warn("⚠️ Email save warning:", saveResult.message);
                        }
                    } catch (saveError) {
                        console.error("❌ Error saving email to database:", saveError);
                    }

                    localStorage.setItem("userEmail", finalEmail);
                    localStorage.setItem("walletAddress", walletAddress);
                    localStorage.setItem("loginTimestamp", new Date().toISOString());
                    localStorage.setItem("chainUsed", activeChain?.name || "unknown-chain");
                    localStorage.setItem("factoryAddress", ACCOUNT_FACTORY_ADDRESS || "not-configured");
                }

                setProcessed(true);
                onEmailCaptured();

                const target: string = finalEmail || "no-email";
                setTimeout(
                    () => router.push(`/Query_new?email=${encodeURIComponent(target)}&url=${encodeURIComponent(router.query.url as string || '')}`),
                    2_000,
                );
            } catch (err) {
                console.error("❌ Email capture error:", err);
                setTimeout(
                    () => router.push("/Query_new?status=logged-in-no-email"),
                    2_000,
                );
            }
        })();
    }, [wallet, processed, onEmailCaptured, router]);

    return null;
};

export default SignInPage;
