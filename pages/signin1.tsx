import React, { useState, useEffect, useContext, ChangeEvent } from "react";
import { useRouter } from 'next/router';
import Image from "next/image";
import { ConnectEmbed, darkTheme } from "thirdweb/react";
import { client } from "../util/client";
import { inAppWallet } from "thirdweb/wallets";
import { polygonAmoy, polygon, Chain } from "thirdweb/chains";
import { ACTIVE_CHAIN, ACCOUNT_FACTORY_ADDRESS } from "../constants/constants";
import { LocalizedText, LocalizedText1 } from '../util/LocalizedText';
import { LocalizationContext } from '../util/LocalizationContext';
import styles from "../styles/Signin.module.css";
import HashUtil from "../util/hashToFixedDigits"; // Added import for HashUtil

import { toast } from 'react-toastify';
import OpenWebsiteToast from '../components/OpenWebsiteToast';

// Custom dark theme configuration
const customTheme = darkTheme({
    colors: {
        modalBg: "Blue",
    },
});

// Mapping of chain identifiers to Chain objects
const chainMap: { [key: string]: Chain } = {
    "polygon-amoy-testnet": polygonAmoy,
    "polygon": polygon, // Polygon mainnet
};

// Select the active chain based on the ACTIVE_CHAIN constant
const activeChain: Chain = chainMap[ACTIVE_CHAIN];

const SignInPage: React.FC = () => {
  
  return (
   <div className={styles.authContainer}>
                {/* ConnectEmbed Component for Wallet Connection */}
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

              

            </div>
  );
};

export default SignInPage;
