import { SmartWallet, useAddress, useInAppWallet, useWallet, WalletConnect } from "@thirdweb-dev/react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react"
import styles from "../styles/Home.module.css";
import { NextPage } from "next";
import EmailSignIn from "./EmailLogin";
import Connected from "../components/Connected";
import { useState } from "react";

import {
    inAppWallet,
    preAuthenticate,
} from "thirdweb/wallets/in-app";

const Home: NextPage = () => {
    //const address = useAddress();
    //const wallet = useWallet();
    const [accountAddress, setAccountAddress] = useState<string | null>(null);

    const handleAccountConnected = (wallet: any, address: string) => {
        setAccountAddress(address);
    };
    console.log("address is ", accountAddress);

    return (
        <main className={styles.main}>
            <div className={styles.container}>
                <main className={styles.main}>
                    <div className={styles.container}>
                        {accountAddress ? (
                            <Connected smartWalletAddress={accountAddress} />
                        ) : (
                            <EmailSignIn onAccountConnected={handleAccountConnected} />
                        )}
                    </div>
                </main>
            </div>
        </main>
    );
};

export default Home;
