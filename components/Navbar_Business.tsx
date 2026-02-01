import React, { useState, useRef, useEffect, ChangeEvent, useCallback, useContext, useMemo } from 'react';
import Link from "next/link";
import { useActiveWallet, useConnect, ConnectButton, ConnectEmbed, lightTheme } from "thirdweb/react";
import { useActiveAccount } from '../hooks/useWalletAddress';
import { usePrivy } from '@privy-io/react-auth'; // ✅ Migrated from Auth0 to Privy
import Image from 'next/image';
import Modal from 'react-modal';
import styles from "../styles/Home4.module.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTwitter, faFacebookF, faLinkedinIn, faReddit } from '@fortawesome/free-brands-svg-icons';
import HistoryModal from './HistoryModal';
import { useRouter } from 'next/router';
import HashUtil from '../util/hashToFixedDigits';
import { LocalizationContext } from '../util/LocalizationContext';
import { client } from "../util/client"
import { inAppWallet } from "thirdweb/wallets";
import { ACTIVE_CHAIN, ACCOUNT_FACTORY_ADDRESS, WEBAI_TOKEN_ADDRESS } from "../constants/constants";
import { baseSepolia, base, Chain } from "thirdweb/chains";
import { ethers } from "ethers";
import { getLocalizedString, LocalizedText } from '../util/LocalizedText';
import { useSharedContext } from '../context/SharedContext'; // Import the shared context
import { toast } from 'react-toastify';
import { ChatModalContext } from '../context/ChatModalContext'; // **New Import for ChatModalContext**
import { loadStripe } from '@stripe/stripe-js'; // **Added import for Stripe**
import { Wallet } from 'thirdweb/wallets';
import { MarketingChatModalContext } from '../context/MarketingChatModalContext';
import { BusinessChatModalContext } from '../context/BusinessChatModalContext';
// Define the interface for Navbar props
interface NavbarProps {
    isMarketingPage?: boolean;
}

// Define the minimal ERC-20 ABI
const erc20Abi = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
];

// Define the Product interface
interface Product {
    id: number;
    title: string;
    priceId: string;
    description: string;
    includedItems: string[];
    itemName: string;
    imageUrl: string;
    price: string;       // Added price field
    totalValue: string;  // Added totalValue field
}

const contentKeys = {
    referFriend: 'referFriend',
    freeChats: 'freeChats',
    loadingReferral: 'loadingReferral',
    failedToLoadReferral: 'failedToLoadReferral',
    modalTitle: 'modalTitle',
    copyText: 'copyText',
    copyButton: 'copyButton',
    closeButton: 'closeButton',
    chatLink: 'chatLink',
    shopLink: 'shopLink',
    shareButton: 'shareButton',
    shareMessage: 'shareMessage',
    free_Chats: 'free_Chats',
    balance: 'balance',
    welcome: 'welcome',
    tooltipDemo: 'tooltipDemo',
    redditMessage: 'redditMessage', // Added new key for tooltip
};

// **Stripe Initialization**
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// **Define the products data with provided price IDs**
const products: Product[] = [
    {
        id: 2,
        title: "Professional AI Productivity Pack",
        //priceId: "price_1QWW41B6lkwYc71EqYHq4Gf6",
        //priceId: "price_1QWTwxB6lkwYc71EE25fjebc", //for testing
        priceId: process.env.NEXT_PUBLIC_CONFIG_ENV === "dev"
            ? "price_1R4WC2B6lkwYc71Et6Apromk"
            : "price_1R4YN4B6lkwYc71EmgtMNqqC",
        description: "Unlock advanced AI functionality with 50,000 transferable chats and premium features designed to boost productivity and deliver exceptional AI experiences. Perfect for professionals seeking fast and efficient solutions",
        includedItems: [
            "50,000 Free Chats ($500 value)",
            "100 Free Knowledge Base Text Uploads ($200 value)",
            "10 Free Web Scrape Website into your Knowledge Base ($100 value)",
            "Faster Response Time ($50 value)",
            "Priority Access to the Latest AI Models (LLMs) ($200 value)",
            "Fine-Tune LLMs into SLMs for Tailored Use ($200 value)",

        ],
        itemName: "AI Professional Pack",
        imageUrl: "/images/pro-level.png",
        price: "$500",
        totalValue: "$1250",
    },
    {
        id: 1,
        title: "Entry Level AI Starter Pack",
        //priceId: "price_1QWWYCB6lkwYc71EJewTCk2a", //For prod
        // priceId: "price_1QWWLRB6lkwYc71EcKJAHDxy",//For testing
        priceId: process.env.NEXT_PUBLIC_CONFIG_ENV === "dev"
            ? "price_1QWWLRB6lkwYc71EcKJAHDxy"
            : "price_1R4YNMB6lkwYc71EmcSIGP3b",

        description: "Start your AI journey with $50 credited to your account, giving you 5,000 free chats that can be shared with your team, along with access to exclusive perks designed to enhance productivity and reduce costs. Perfect for individuals exploring how AI can transform their workflows",
        includedItems: [
            "5,000 Free Chats ($50 value)",
            "10 Free Knowledge Base Text Uploads ($20 value)",
            "2 Free Web Scrape Website into your Knowledge Base ($20 value)",
            "Faster Response Time ($50 value)",
        ],
        itemName: "AI Starter Pack",
        imageUrl: "/images/entry-level.png",
        price: "$50",
        totalValue: "$140",
    },
    {
        id: 3,
        title: "Enterprise AI Collaboration Suite",
        //priceId: "price_1QWWYHB6lkwYc71EY69zZdHO", //for prod
        //priceId: "price_1QWWVHB6lkwYc71ElMZJy9UQ",// For testing 
        priceId: process.env.NEXT_PUBLIC_CONFIG_ENV === "dev"
            ? "price_1QWWVHB6lkwYc71ElMZJy9UQ"
            : "price_1R4YNCB6lkwYc71E5xiE8zMs",
        description: "Maximize your organization's AI efficiency with 100,000 chats and the ability to share the credited amount among employees to boost productivity and collaboration. Tailored for enterprises looking to revolutionize workflows with cutting-edge AI capabilities",
        includedItems: [
            "100,000 Free Chats ($1000 value)",
            "250 Free Knowledge Base Text Uploads ($250 value)",
            "20 Free Web Scrape Website into your Knowledge Base ($200 value)",
            "Faster Response Time ($50 value)",
            "Priority Access to the Latest AI Models (LLMs) ($200 value)",
            "Fine-Tune LLMs into SLMs for Tailored Use ($200 value)",
            "Team Setup for Shared Knowledge Base and Collaborative Access Across Employees",
        ],
        itemName: "AI Enterprise Suite",
        imageUrl: "/images/enterprise-level.png",
        price: "$1000",
        totalValue: "$1,850",
    },
];

interface TokenOption {
    address: string;
    name: string;
    symbol: string;
    icon: string;
}

interface CustomConnectButtonProps {
    client: any;
    activeChain: any;
    WEBAI_TOKEN_ADDRESS: string;
    ACCOUNT_FACTORY_ADDRESS: string;
    selectedToken: 'USD' | 'MATIC'; // Add selectedToken prop
    setSelectedToken: React.Dispatch<React.SetStateAction<'USD' | 'MATIC'>>;
    handleConnect: (connectedWallet: Wallet) => Promise<void>;
    showBalance: boolean; // **New Prop to Control Balance Display**
}

const Navbar: React.FC<NavbarProps> = ({ isMarketingPage = false }) => {
    const [modalIsOpen, setModalIsOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const { account, isLoading: authLoading } = useActiveAccount(); // ✅ Get loading state too
    const userAddress = account?.address;
    const [shareMessage, setShareMessage] = useState("Loading referral information...");
    const [redditMessage, setRedditMessage] = useState("Loading referral information...");
    const [referralLink, setReferralLink] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<string>("English");
    const [languages, setLanguages] = useState<string[]>([]);
    const [localizedContent, setLocalizedContent] = useState<Record<string, string>>({});
    const [isInitialBonusAdded, setIsInitialBonusAdded] = useState<boolean>(false);
    const router = useRouter();
    const [tokenBalance, setTokenBalance] = useState<{ displayValue: string; symbol: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { freeChatsLeft, setFreeChatsLeft, balanceData, setBalanceData, selectedToken,
        setSelectedToken,
        webaiBalance,
        setWebaiBalance,
        maticBalance,
        setMaticBalance } = useSharedContext(); // Use shared context
    const [isBalanceLoading, setIsBalanceLoading] = useState<boolean>(true);
    const [walletInstance, setWalletInstance] = useState<any>(null);
    const [isShareButtonHovered, setIsShareButtonHovered] = useState(false);
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const chainMap: { [key: string]: Chain } = {
        "base-sepolia-testnet": baseSepolia,
        "base": base,
    };

    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferAddress, setTransferAddress] = useState('');
    const [transferAmount, setTransferAmount] = useState<number>(0);
    const [isTransferring, setIsTransferring] = useState(false);
    const [selectedPerk, setSelectedPerk] = useState<'freeTrades' | 'freeUploads' | 'freeWebScrape' | ''>('');
    const [freeUploadsLeft, setFreeUploadsLeft] = useState<number | null>(0);
    const [freeWebScrapeLeft, setFreeWebScrapeLeft] = useState<number | null>(0);
    const [user1Address, setUser1Address] = useState<string | undefined>(undefined);
    const [wallet, setWallet] = useState<Wallet | null>(null);
    // **Determine whether to show the balance based on freeChatsLeft**
    const showBalance = (freeChatsLeft ?? 0) <= 0;
    const [couponCode, setCouponCode] = useState(''); // New state for coupon code
    const [isAvatorHovered, setIsAvatorHovered] = useState(false);
    const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
    // **New state variables**
    const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
    const regularChatContext = useContext(ChatModalContext);
    const marketingChatContext = useContext(MarketingChatModalContext);
    const businessChatContext = useContext(BusinessChatModalContext);
    // Add these new state variables
    const [selectedCategory, setSelectedCategory] = useState('Favorite');
    const [selectedRoleName, setSelectedRoleName] = useState('');
    const [isShopExpanded, setIsShopExpanded] = useState(false);
    const [availableRoles, setAvailableRoles] = useState<string[]>([]);
    const [isRolesDropdownOpen, setIsRolesDropdownOpen] = useState(false);

    // Categories list
    // const categories = ['Favorite', 'Vibe Marketing', 'Monetization'];
    // Add new state for non-entrepreneur group departments
    const [businessDepartments, setBusinessDepartments] = useState<string[]>([]);

    // Dynamic categories list that combines Favorite with business departments
    const categories = useMemo(() => {
        return ['Favorite', ...businessDepartments];
    }, [businessDepartments]);


    const { openChat } = businessChatContext;
    const { openBusinessChat: openMarketingChat } = marketingChatContext;

    // NEW: Function to fetch non-entrepreneur group departments (business departments)
    const fetchBusinessDepartments = useCallback(async () => {
        try {
            const response = await fetch('/api/get-non-entrepreneur-group-departments', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) {
                const data = await response.json();
                const departments = Array.isArray(data.departments) ? data.departments : [];
                setBusinessDepartments(departments);
            } else {
                console.error('Failed to fetch business departments');
                setBusinessDepartments([]);
            }
        } catch (error) {
            console.error('Error fetching business departments:', error);
            setBusinessDepartments([]);
        }
    }, []);

    // NEW: Function to fetch roles for selected category
    const fetchRolesForCategory = async (category: string) => {
        try {
            const response = await fetch('/api/get-roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: category }),
            });
            if (response.ok) {
                const data = await response.json();
                setAvailableRoles(Array.isArray(data.roles) ? data.roles : []);
            } else {
                setAvailableRoles([]);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
            setAvailableRoles([]);
        }
    };


    // NEW: Handle category change
    const handleCategoryChange = async (category: string) => {
        setSelectedCategory(category);
        setSelectedRoleName(''); // Reset selected role
        setIsShopExpanded(true); // Open shop when category changes

        // Fetch roles for the new category
        await fetchRolesForCategory(category);

        // Pass category change to parent component
        if (window.onCategoryChange) {
            window.onCategoryChange(category);
        }
    };

    // NEW: Handle role selection
    const handleRoleSelection = (roleName: string) => {
        setSelectedRoleName(roleName);
        setIsRolesDropdownOpen(false);

        // Navigate to ChatHome_marketing with selected role
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
        const encodedRole = encodeURIComponent(roleName);
        const encodedCategory = encodeURIComponent(selectedCategory);
        const url = `${baseUrl}/ChatHome_bus?selectedRole=${encodedRole}&selectedCategory=${encodedCategory}`;
        console.log("----Url is ", url);
        const newWindow = window.open(url, '_blank');

        // Set variables in the new window once it loads
        if (newWindow) {
            const checkAndSetRole = () => {
                try {
                    // Check if the new window has loaded and has our function
                    if (newWindow.setSelectedRole) {
                        newWindow.setSelectedRole(roleName);
                        console.log('Role set in new window:', roleName);
                    } else {
                        // Retry after a short delay
                        setTimeout(checkAndSetRole, 100);
                    }
                } catch (error) {
                    console.log('New window not ready yet, retrying...');
                    setTimeout(checkAndSetRole, 100);
                }
            };

            // Start checking after a small delay
            setTimeout(checkAndSetRole, 500);
        }
    };

    const CustomConnectButton: React.FC<CustomConnectButtonProps> = ({
        client,
        activeChain,
        WEBAI_TOKEN_ADDRESS,
        ACCOUNT_FACTORY_ADDRESS,
        selectedToken,
        setSelectedToken,
        showBalance,
    }) => {
        const [isAvatarHovered, setIsAvatarHovered] = useState(false); // Unified tooltip state

        const handleTokenChange = (token: 'USD' | 'MATIC') => {
            setSelectedToken(token);
        };

        return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {/* Single Connect Button with Dynamic Tooltip */}
                <ConnectButton
                    client={client}
                    supportedTokens={
                        selectedToken === 'USD'
                            ? { [activeChain.id]: [{ address: WEBAI_TOKEN_ADDRESS, name: "web3AIstore Token", symbol: "USD", icon: "/images/token.png" }] }
                            : undefined
                    }
                    chain={activeChain}
                    accountAbstraction={{
                        chain: activeChain,
                        sponsorGas: true,
                        factoryAddress: ACCOUNT_FACTORY_ADDRESS,
                    }}
                    wallets={[inAppWallet({ auth: { options: ["email", "google", "apple", "facebook", "phone"] } })]}
                    connectModal={{ showThirdwebBranding: false }}
                    onConnect={(wallet) => {
                        console.log("Connected Wallet Address:", wallet.getAccount()?.address);
                    }}
                    detailsButton={{
                        displayBalanceToken: selectedToken === 'USD' ? { [activeChain.id]: WEBAI_TOKEN_ADDRESS } : undefined,
                        render: () => (
                            <div
                                className={styles.avatarContainer}
                                onMouseEnter={() => setIsAvatarHovered(true)}
                                onMouseLeave={() => setIsAvatarHovered(false)}
                            >
                                <div
                                    style={{
                                        position: "relative",
                                        width: "60px",
                                        height: "60px",
                                        borderRadius: "50%",
                                        backgroundImage: "url('/images/avatar.jpg')",
                                        backgroundSize: "contain",
                                        backgroundRepeat: "no-repeat",
                                        backgroundPosition: "center",
                                        transition: "transform 0.3s ease, box-shadow 0.3s ease",
                                    }}
                                    className={isAvatarHovered ? styles.avatarHover : ""}
                                />
                                {/* Unified Tooltip */}
                                {isAvatarHovered && (
                                    <div className={styles.tooltip1}>
                                        {selectedToken === 'USD'
                                            ? <LocalizedText name="Click on the Avatar to See the balance or transfer USD" />
                                            : <LocalizedText name="Click on the Avatar to See the balance or transfer MATIC" />}
                                    </div>
                                )}
                            </div>
                        ),
                    }}
                />

                {/* Token Radio Buttons 
                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '10px' }}>
                    <label style={{ marginBottom: '5px' }}>
                        <input
                            type="radio"
                            value="USD"
                            checked={selectedToken === 'USD'}
                            onChange={() => handleTokenChange('USD')}
                        />
                        USD
                    </label>
                    <label>
                        <input
                            type="radio"
                            value="MATIC"
                            checked={selectedToken === 'MATIC'}
                            onChange={() => handleTokenChange('MATIC')}
                        />
                        MATIC
                    </label>
                </div> */}
            </div>
        );
    };

    // Add near the top with other state variables
    const [userCoupons, setUserCoupons] = useState<Record<number, number>>({});

    // Add this useEffect to fetch coupon codes when the modal opens
    useEffect(() => {
        const fetchUserCoupons = async () => {
            if (!userAddress) return;

            try {
                const response = await fetch(`/api/get-coupon-code?accountAddress=${encodeURIComponent(userAddress)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.coupons) {
                        setUserCoupons(data.coupons);
                    }
                }
            } catch (error) {
                console.error('Error fetching coupon codes:', error);
            }
        };

        if (isRefillModalOpen) {
            fetchUserCoupons();
        }
    }, [isRefillModalOpen, userAddress]);

    const handleConnect = async (connectedWallet: Wallet) => {
        setWallet(connectedWallet);
        const address = connectedWallet.getAccount()?.address;
        setUser1Address(address);
        console.log('Connected Wallet Address:', address);

        // Fetch WEBAI token balance upon connection
        fetchWebaiTokenBalance(address);
        fetchMaticBalance(address);
    };

    // Add a new function to fetch MATIC balance
    const fetchMaticBalance = async (address: string | undefined) => {
        if (!address) return;
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const balance = await provider.getBalance(address);
            const formattedBalance = ethers.utils.formatEther(balance);
            setMaticBalance(parseFloat(formattedBalance).toFixed(3));
        } catch (error) {
            console.error("Error fetching MATIC balance:", error);
        }
    };


    const fetchWebaiTokenBalance = async (userAddress: string | undefined) => {
        if (userAddress) {
            try {
                const provider = new ethers.providers.JsonRpcProvider(activeChain.rpc);
                const erc20Contract = new ethers.Contract(
                    WEBAI_TOKEN_ADDRESS,
                    erc20Abi,
                    provider
                );
                const balance = await erc20Contract.balanceOf(userAddress);
                const decimals = await erc20Contract.decimals();
                const formattedBalance = ethers.utils.formatUnits(balance, decimals);
                setWebaiBalance(parseFloat(formattedBalance).toFixed(3));
            } catch (error) {
                console.error("Failed to fetch WEBAI token balance:", error);
            }
        }
    };

    // **Modify existing functions or add new ones**

    // Function to handle the Refill button click
    const handleRefill = () => {
        setIsRefillModalOpen(true);
    };

    // **Function to handle Transfer button click**
    const handleTransferClick = () => {
        setIsTransferModalOpen(true);
    };

    // Function to fetch user perks
    const fetchUserPerks = async () => {
        if (!userAddress) return;

        try {
            const response = await fetch(`/api/get-user-perks?userAddress=${encodeURIComponent(userAddress)}`);
            if (response.ok) {
                const data = await response.json();
                setFreeChatsLeft(data.freeTrades);
                setFreeUploadsLeft(data.freeUploads);
                setFreeWebScrapeLeft(data.freeWebScrape);
            } else {
                const errorData = await response.json();
                toast.error(errorData.message || 'Failed to retrieve perks.');
            }
        } catch (error) {
            console.error('Error fetching user perks:', error);
            toast.error('An unexpected error occurred while fetching perks.');
        }
    };

    // ✅ Updated to use Privy logout and login
    const { logout: privyLogout, login: privyLogin, user: privyUser } = usePrivy();

    const handleLogout = async () => {
        // Show confirmation toast
        const confirmLogout = window.confirm(
            await getLocalizedString('Are you sure you want to logout?', language)
        );

        if (!confirmLogout) return;

        try {
            // Clear localStorage wallet cache
            if (userAddress) {
                localStorage.removeItem(`wallet_${userAddress}`);
            }

            // Show logout toast
            toast.info(await getLocalizedString('Logging out...', language));

            // Use Privy logout
            await privyLogout();

            // Redirect to home after logout
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect even if there's an error
            window.location.href = '/';
        }
    };


    useEffect(() => {
        const promoCodeParam = router.query.promoteCode;
        const refParam = router.query.Ref;

        if (refParam && userAddress) {
            // Parse the Ref parameter: format is referrerId:promoCode
            const [referrerId, promoCode] = String(refParam).split(':');
            // ADD THIS CHECK: Prevent self-referrals
            const hashedAddress = HashUtil.hashTo(userAddress);
            if (referrerId === hashedAddress) {
                toast.error('You cannot refer yourself.');
                return; // Early return for self-referral
            }

            // Check if user already has a referrer and if the referrer is valid
            fetch('/api/check-referrer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userKey: userAddress,
                    referrerId: referrerId
                }),
            })
                .then(res => res.json())
                .then(data => {
                    if (!data.hasReferrer) {
                        // Only save if it's a valid referrer
                        if (data.isValidReferrer) {
                            // Save referrer if they don't have one already and it's valid
                            fetch('/api/save-referrer', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userKey: userAddress,
                                    referrerId: referrerId,
                                }),
                            })
                                .then(res => res.json())
                                .then(saveData => {
                                    if (saveData.success) {
                                        toast.success('Referral link applied successfully.');
                                        // Process the promo code part if it exists
                                        if (promoCode) {
                                            handlePromoCode(promoCode, String(refParam));
                                        }
                                    } else {
                                        toast.error('Failed to apply referral.');
                                        // Do not process promo code on referral failure
                                        return;
                                    }
                                })
                                .catch(err => toast.error(`Error saving referral: ${err.message}`));
                        } else {
                            toast.info('Invalid referral link. The referrer account is not active.');
                            // Do not process promo code for invalid referrer
                            return;
                        }
                    } else {
                        toast.info('You already have a referrer associated with your account.');
                        // Process the promo code part if it exists - allow this even if referrer exists
                        if (promoCode) {
                            handlePromoCode(promoCode, String(refParam));
                        }
                    }
                })
                .catch(err => toast.error(`Error checking referral: ${err.message}`));

        } else if (promoCodeParam && userAddress) {
            // If no ref parameter but promo code exists
            if (String(promoCodeParam).includes(':')) {
                const [uniqueId, promoType] = String(promoCodeParam).split(':');
                handlePromoCode(promoType, String(promoCodeParam)).catch(err =>
                    console.error('Error in handlePromoCode:', err)
                );
            } else {
                handlePromoCode(String(promoCodeParam)).catch(err =>
                    console.error('Error in handlePromoCode:', err)
                );
            }
        }

        async function handlePromoCode(promoCode: string, fullPromoString?: string): Promise<void> {
            if (!userAddress) return;

            try {
                // Note: Duplicate prevention is handled by the add-webai-credits API
                // It tracks promo usage globally for unique links (:) format
                // and per-user for standard promo codes

                if (promoCode === 'prom40') {
                    const emailPromoBonus = Number(process.env.NEXT_PUBLIC_EMAIL_PROMO_BONUS) || 20;
                    fetch('/api/proxy-add-webai-credits', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userKey: userAddress,
                            webaiCredits: emailPromoBonus,
                            promoCodeUsed: fullPromoString || promoCode,
                            setMode: true, // Promo takes priority - SET credits instead of adding
                        }),
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.success && userAddress) {
                                addPromoCoupons(userAddress);
                                toast.success(`Promo applied! ${emailPromoBonus} WEBAI Credits added.`);
                                fetchUserPerks();
                                window.dispatchEvent(new CustomEvent('refreshWebaiCredits'));
                            } else if (data.message && data.message.includes('already been used')) {
                                if (fullPromoString && fullPromoString.includes(':')) {
                                    toast.info('This unique promotion link has already been used.');
                                } else {
                                    toast.info('You have already used this promo code.');
                                }
                            } else {
                                toast.error(`Failed to apply promo code. ${data.message}`);
                            }
                        })
                        .catch(err => toast.error(`Error applying promo code. ${err.message}`));
                }
            } catch (err) {
                console.error('Error checking for existing coupons:', err);
                toast.error('Failed to check for existing promotions.');
            }
        }
    }, [router.query.promoteCode, router.query.Ref, userAddress]);

    // Function to add product-specific coupon discounts
    const addPromoCoupons = async (accountAddress: string) => {
        try {
            // Product ID 2: Professional AI Productivity Pack - 40% discount
            await fetch('/api/add-coupon-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountAddress,
                    productId: 2,
                    discountPercentage: 40,
                }),
            });

            // Product ID 1: Entry Level AI Starter Pack - 20% discount
            await fetch('/api/add-coupon-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountAddress,
                    productId: 1,
                    discountPercentage: 20,
                }),
            });

            // Product ID 3: Enterprise AI Collaboration Suite - 30% discount
            await fetch('/api/add-coupon-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountAddress,
                    productId: 3,
                    discountPercentage: 30,
                }),
            });

            console.log('All coupon codes added successfully');
        } catch (error) {
            console.error('Error adding coupon codes:', error);
        }
    };


    // Set the coupon code from the environment variable when the component mounts
    useEffect(() => {
        const envCouponCode = process.env.NEXT_PUBLIC_COUPON_CODE;
        if (envCouponCode) {
            setCouponCode(envCouponCode);
        } else {
            console.warn('NEXT_PUBLIC_COUPON_CODE is not set in the environment variables.');
        }
    }, []);

    // Fetch user perks when the modal opens
    useEffect(() => {
        if (isTransferModalOpen) {
            fetchUserPerks();
        }
    }, [isTransferModalOpen]);

    // **Function to handle Transfer submission - transfers WEBAI credits**
    const handleTransferSubmit = async () => {
        if (!userAddress) {
            const message = 'Please connect your wallet before transferring';
            alert(await getLocalizedString(message, language));
            return;
        }

        if (!transferAddress || transferAmount <= 0) {
            const message = 'Please select a recipient and enter a valid amount';
            alert(await getLocalizedString(message, language));
            return;
        }

        // Prevent transferring to the same address
        if (userAddress.trim().toLowerCase() === transferAddress.trim().toLowerCase()) {
            const message = 'You cannot transfer credits to your own address';
            alert(await getLocalizedString(message, language));
            return;
        }

        // Check if user has enough credits
        const currentBalance = freeChatsLeft ?? 0;
        if (currentBalance < transferAmount) {
            const message = `Insufficient credits. You have $${currentBalance} available.`;
            alert(await getLocalizedString(message, language));
            return;
        }

        setIsTransferring(true);

        try {
            // Use the transferCredits API which handles WEBAI credit transfers
            const response = await fetch('/api/transferCredits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromAddress: userAddress,
                    toAddress: transferAddress,
                    amount: transferAmount,
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                const message = `Successfully transferred $${transferAmount} credits!`;
                toast.success(await getLocalizedString(message, language));

                // Update the local balance
                setFreeChatsLeft((freeChatsLeft ?? 0) - transferAmount);

                // Reset form and close modal
                setTransferAddress('');
                setTransferAmount(0);
                setIsTransferModalOpen(false);
            } else {
                const message = data.error || data.message || 'Failed to transfer credits.';
                alert(await getLocalizedString(message, language));
            }
        } catch (error) {
            console.error('Error transferring credits:', error);
            toast.error('An unexpected error occurred. Please try again.');
        } finally {
            setIsTransferring(false);
        }
    };



    // Function to initiate the Stripe Checkout session


    const handlePurchase = async (product: Product) => {
        if (!userAddress) {
            toast.error('Please connect your wallet before purchasing.');
            return;
        }

        try {
            // Get the discount percentage for this product (or use default)
            const discountRate = (() => {
                if (userCoupons && userCoupons[product.id]) {
                    return userCoupons[product.id] / 100; // Convert percentage to decimal
                }
                // Default discounts if no coupon exists
                switch (product.id) {
                    case 1: return 0.2; // 20% discount
                    case 2: return 0.4; // 40% discount
                    case 3: return 0.3; // 30% discount
                    default: return 0;
                }
            })();

            // Convert discount rate to percentage and format coupon code (e.g., 40OFF)
            const discountPercentage = Math.round(discountRate * 100);
            const formattedCouponCode = discountPercentage > 0 ? `${discountPercentage}OFF` : null;

            const response = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: product.priceId,
                    userId: userAddress,
                    productId: product.id,
                    couponCode: formattedCouponCode, // Use formatted coupon code with new naming convention
                }),
            });

            const data = await response.json();

            if (data.url) {
                // Redirect to Stripe Checkout
                window.location.href = data.url;
            } else {
                // Handle error
                console.error('Failed to create checkout session:', data.error);
                toast.error('Failed to initiate payment. Please try again.');
            }
        } catch (error) {
            console.error('Error during purchase:', error);
            toast.error('An unexpected error occurred. Please try again.');
        }
    };


    // **Access ChatModalContext**
    //const { openChat } = useContext(ChatModalContext);
    const activeChain: Chain = chainMap[ACTIVE_CHAIN];
    const activeWallet = useActiveWallet();
    const customTheme = lightTheme({
        colors: {
            modalBg: "red",
        },
    });

    const { connect, isConnecting, error } = useConnect();
    const [isAskAiHovered, setIsAskAiHovered] = useState(false);

    const handleRefreshBalance = useCallback(() => {
        if (userAddress) {
            setIsBalanceLoading(true);
            setBalanceData(null); // Reset the balance before fetching again

            if (selectedToken === 'MATIC') {
                const fetchBalance = async () => {
                    const provider = new ethers.providers.JsonRpcProvider(activeChain.rpc);
                    const balance = await provider.getBalance(userAddress);
                    const formattedBalance = ethers.utils.formatEther(balance);
                    setBalanceData(parseFloat(formattedBalance).toFixed(3));
                };
                fetchBalance();
            } else {
                fetchWebaiTokenBalance(userAddress);
            }
        }
    }, [userAddress, activeChain, setBalanceData, selectedToken]);


    const { language, setLanguage } = useContext(LocalizationContext);

    // Validation function for hashed addresses (10-digit numeric string)
    const isValidHashedAddress = (hash: string): boolean => {
        const regex = /^\d{10}$/;
        return regex.test(hash);
    };


    useEffect(() => {
        if (router.query.refill === 'true') {
            setIsRefillModalOpen(true);
        }
    }, [router.query.refill]);

    useEffect(() => {
        if (router.query.rc && typeof router.query.rc === 'string') {
            setReferralCode(router.query.rc);
        }
    }, [router.query.rc]);

    // Ensure that Modal is attached to the correct element
    useEffect(() => {
        Modal.setAppElement('#__next');
    }, []);

    // Listen for refreshWebaiCredits event to auto-update balance after MCP payment
    useEffect(() => {
        const handleRefreshCredits = async () => {
            if (!userAddress) return;

            console.log('🔄 Refreshing WEBAI credits after payment...');
            try {
                const response = await fetch('/api/get-free-trades', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userAddress }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setFreeChatsLeft(data.freeTrades);
                    console.log('✅ Balance refreshed:', data.freeTrades);
                }
            } catch (error) {
                console.error('Error refreshing credits:', error);
            }
        };

        window.addEventListener('refreshWebaiCredits', handleRefreshCredits);
        return () => window.removeEventListener('refreshWebaiCredits', handleRefreshCredits);
    }, [userAddress, setFreeChatsLeft]);

    // New useEffect for processing referrals
    useEffect(() => {
        const processReferral = async () => {
            if (!userAddress) return;

            const { rc } = router.query;

            try {
                let referrerAddress: string | null = null;

                if (rc && typeof rc === 'string') {
                    // Assume rc is the hashed referrerAddress
                    referrerAddress = rc;

                    // Validate the referrerAddress format
                    if (!isValidHashedAddress(referrerAddress)) {
                        console.error('Invalid referrer address format');
                        referrerAddress = null; // Set to null to pass to API
                    }

                    // Generate the hashed refereeAddress
                    const hashedUserAddress = HashUtil.hashTo(userAddress || '');

                    // **Add null check before comparing**
                    if (referrerAddress && hashedUserAddress.toLowerCase() === referrerAddress.toLowerCase()) {
                        console.warn('User cannot refer themselves');
                        referrerAddress = null; // Set to null to pass to API
                    }
                }

                // Generate the hashed refereeAddress
                const hashedUserAddress = HashUtil.hashTo(userAddress || '');

                // Check if there's a promo code in URL - if so, skip initial credits (promo takes priority)
                const promoteCode = router.query.promoteCode as string | undefined;
                const hasPromoCode = !!promoteCode && promoteCode.includes(':prom');

                // Call the /api/add-referral API with or without referrerAddress
                const response = await fetch('/api/add-referral', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        referrerAddress: referrerAddress, // Can be null
                        refereeAddress: hashedUserAddress,
                        skipInitialCredits: hasPromoCode, // Skip initial credits if promo code will provide them
                    }),
                });

                const data = await response.json();

                if (response.ok) {
                    if (referrerAddress) {
                        toast.success('Referral bonus applied successfully!', { autoClose: 10000 });
                    }

                    // Show appropriate welcome message based on whether promo code is pending
                    if (hasPromoCode) {
                        const emailPromoBonus = Number(process.env.NEXT_PUBLIC_EMAIL_PROMO_BONUS) || 20;
                        const welcomeMessage = await getLocalizedString('Welcome! You have received ${0} WEBAI Credits.', language);
                        toast.info(welcomeMessage.replace('${0}', String(emailPromoBonus)), {
                            autoClose: 10000
                        });
                    } else {
                        const initialCredits = Number(process.env.NEXT_PUBLIC_INITIAL_WEBAI_CREDITS) || 10;
                        const referralBonus = Number(process.env.NEXT_PUBLIC_REFERRAL_BONUS) || 2;
                        const totalCredits = initialCredits + referralBonus;
                        const welcomeMessage = await getLocalizedString('Welcome! You have received ${0} WEBAI Credits.', language);
                        toast.info(welcomeMessage.replace('${0}', String(totalCredits)), {
                            autoClose: 10000
                        });
                    }
                    setIsInitialBonusAdded(true);
                } else {
                    // Optionally handle specific errors
                    console.error('Referral API response not OK:', data.message || 'Unknown error');
                }

                // Fetch free trades after processing referral, regardless of API response
                const fetchFreeTrades = async () => {
                    if (!userAddress) return;

                    try {
                        const response = await fetch('/api/get-free-trades', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userAddress }),
                        });

                        if (!response.ok) {
                            console.log(`Fetch free trades failed: ${response.status}`);
                            return;
                        }

                        const data = await response.json();

                        // Update freeChatsLeft state
                        setFreeChatsLeft(data.freeTrades);

                        // Fetch balance if freeChatsLeft is 0 or below
                        if (data.freeTrades <= 0) {
                            handleRefreshBalance();

                        }
                    } catch (error) {
                        console.error('Error fetching free trades:', error);
                    }
                };

                // Call fetchFreeTrades regardless of referral API response
                fetchFreeTrades();
            } catch (error) {
                console.error('Error processing referral:', error);
                toast.error('An error occurred while processing your referral.', { autoClose: 5000 });

                // Attempt to fetch free trades even if there's an error
                const fetchFreeTrades = async () => {
                    if (!userAddress) return;

                    try {
                        const response = await fetch('/api/get-free-trades', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userAddress }),
                        });

                        if (!response.ok) {
                            console.log(`Fetch free trades failed: ${response.status}`);
                            return;
                        }

                        const data = await response.json();

                        // Update freeChatsLeft state
                        setFreeChatsLeft(data.freeTrades);

                        // Fetch balance if freeChatsLeft is 0 or below
                        if (data.freeTrades <= 0) {
                            handleRefreshBalance();
                        }
                    } catch (error) {
                        console.error('Error fetching free trades:', error);
                    }
                };

                fetchFreeTrades();
            }
        };

        processReferral();
    }, [router.query, userAddress, handleRefreshBalance, isInitialBonusAdded]);

    // Existing balance fetching useEffect
    useEffect(() => {
        const fetchBalance = async () => {
            if (userAddress) {
                try {
                    const provider = new ethers.providers.JsonRpcProvider(activeChain.rpc);
                    const erc20Contract = new ethers.Contract(
                        WEBAI_TOKEN_ADDRESS,
                        erc20Abi,
                        provider
                    );
                    const balance = await erc20Contract.balanceOf(userAddress);
                    const formattedBalance = ethers.utils.formatEther(balance);
                    const formattedBalanceThreeDigits = parseFloat(formattedBalance).toFixed(3);

                    setBalanceData(formattedBalanceThreeDigits);
                    //console.log("The balance is ", formattedBalanceThreeDigits);
                } catch (error) {
                    console.error("Failed to fetch balance:", error);
                } finally {
                    setIsBalanceLoading(false);
                }
            }
        };

        fetchBalance();
        //console.log(" user account's number is ", userAddress);

    }, [userAddress, setBalanceData]);

    // NEW: Close roles dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('[data-roles-dropdown]')) {
                setIsRolesDropdownOpen(false);
            }
        };

        if (isRolesDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isRolesDropdownOpen]);


    // NEW: Fetch business departments on component mount
    useEffect(() => {
        fetchBusinessDepartments();
    }, [fetchBusinessDepartments]);


    // NEW: Fetch initial roles for default category
    useEffect(() => {
        fetchRolesForCategory(selectedCategory);
    }, []);


    const handleRefreshFreeChats = useCallback(async () => {
        try {
            const response = await fetch('/api/get-free-trades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress }),
            });

            if (!response.ok) {
                console.error(`Fetch free trades failed: ${response.status}`);
                return;
            }

            const data = await response.json();
            setFreeChatsLeft(data.freeTrades);

            // Fetch balance if freeChatsLeft is 0 or below
            if (data.freeTrades <= 0) {
                handleRefreshBalance();
            }
        } catch (error) {
            console.error('Error fetching free trades:', error);
        }
    }, [userAddress, handleRefreshBalance, setFreeChatsLeft]);

    useEffect(() => {
        const handleRefreshBalanceEvent = () => {
            console.log('refreshBalance event received');
        };
        window.addEventListener('refreshBalance', handleRefreshBalanceEvent);
        window.addEventListener('refreshFreeChats', handleRefreshFreeChats);

        return () => {
            window.removeEventListener('refreshBalance', handleRefreshBalanceEvent);
            window.removeEventListener('refreshFreeChats', handleRefreshFreeChats);
        };
    }, [handleRefreshFreeChats]);  // ✅ Add handleRefreshFreeChats as dependency

    // 🔄 Poll balances every 30 seconds
    useEffect(() => {
        if (!userAddress) return;

        const pollBalances = () => {
            console.log('🔄 Polling USD and USDC balances...');
            handleRefreshFreeChats(); // Refresh USD (WEBAI credits from KV)
            handleRefreshBalance();   // Refresh USDC (on-chain balance)
        };

        // Start polling
        const intervalId = setInterval(pollBalances, 30000); // 30 seconds

        return () => clearInterval(intervalId);
    }, [userAddress, handleRefreshFreeChats, handleRefreshBalance]);

    const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY;
    if (!SECRET_KEY) {
        throw new Error("ENCRYPTION_KEY is not set in the environment variables.");
    }

    useEffect(() => {
        Modal.setAppElement('#__next');
    }, []);

    useEffect(() => {
        //console.log("Updated balanceData in Navbar:", balanceData);
        if (balanceData !== undefined && balanceData !== null && !isBalanceLoading) {
            setTokenBalance({
                displayValue: balanceData,
                symbol: "USD"
            });
        }
    }, [balanceData, isBalanceLoading]);

    const updateBalance = useCallback(() => {
        fetchWebaiTokenBalance(userAddress);
        /* if (balanceData && !isBalanceLoading) {
             //console.log("Calling updateBalance with balanceData:", balanceData);
             setTokenBalance({
                 displayValue: balanceData,
                 symbol: "Matic"
             });
         }*/
    }, [balanceData, isBalanceLoading]);

    useEffect(() => {
        updateBalance();
    }, [updateBalance]);

    // Removed: useEffect containing addInitialBonus and fetchFreeTrades

    const fetchReferralInfo = async () => {
        if (!userAddress) return;
        try {
            const baseURL = process.env.NEXT_PUBLIC_BASE_URL
                ? process.env.NEXT_PUBLIC_BASE_URL.includes("http://") || process.env.NEXT_PUBLIC_BASE_URL.includes("https://")
                    ? process.env.NEXT_PUBLIC_BASE_URL
                    : `https://${process.env.NEXT_PUBLIC_BASE_URL}`
                : "https://defaultdomain.com";

            const referralLink = `${baseURL}/?Ref=${HashUtil.hashTo(userAddress)}:prom40`;
            setReferralLink(referralLink);

            const initialFreeChats = process.env.NEXT_PUBLIC_INITIAL_FREE_CHATS || "100";
            const referralBonus = process.env.NEXT_PUBLIC_REFERRAL_BONUS || "25";
            const totalFreeChats = Number(initialFreeChats) + Number(referralBonus);

            const shareMessageTemplate = localizedContent.shareMessage || "";
            const finalShareMessage = shareMessageTemplate
                .replace("${totalFreeChats}", totalFreeChats.toString())
                .replace("${initialFreeChats}", initialFreeChats.toString())
                .replace("${referralBonus}", referralBonus.toString())
                .replace("${referralBonus}", referralBonus.toString())
                .replace("${referralLink}", referralLink)
                .replace(/\\n\\n/g, "\n\n");
            //.replace(/\n/g, '<br />');
            ;

            //console.log(finalShareMessage);
            setShareMessage(finalShareMessage);
            const redditMessageTemplate = localizedContent.redditMessage || "";
            const finalRedditMessage = redditMessageTemplate
                .replace("${totalFreeChats}", totalFreeChats.toString())
                .replace("${initialFreeChats}", initialFreeChats.toString())
                .replace("${referralBonus}", referralBonus.toString())
                .replace("${referralBonus}", referralBonus.toString())
                .replace("${referralLink}", referralLink)
                .replace(/\\n\\n/g, "\n\n");

            setRedditMessage(finalRedditMessage);
        } catch (error) {
            console.error("Failed to fetch user ID:", error);
            setShareMessage(localizedContent.failedToLoadReferral || "Failed to load referral information. Please try again.");
        }
    };

    const fetchLocalizedContent = async (language: string) => {
        try {
            const content: Record<string, string> = {};
            for (const key of Object.values(contentKeys)) {
                const response = await fetch('/api/get_content_in_language', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: `label:${key}`,
                        language: language
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    let localizedText = data.content || '';

                    content[key] = localizedText.replace(/"/g, ""); // Remove quotes from localized text
                }
            }
            setLocalizedContent(content);
        } catch (error) {
            console.error("Failed to fetch localized content:", error);
        }
    };

    const initializeContent = async () => {
        const fetchLanguages = async () => {
            try {
                const response = await fetch('/api/get_all_languages');
                if (response.ok) {
                    const langs: string[] = await response.json();
                    setLanguages(Array.from(new Set(langs))); // Ensure unique languages
                }
            } catch (error) {
                console.error("Error fetching languages:", error);
            }
        };

        const fetchUserLanguage = async () => {
            if (userAddress) {
                try {
                    const response = await fetch(`/api/get_user_language?userAddress=${userAddress}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.language) {
                            setSelectedLanguage(data.language);
                            setLanguage(data.language);
                        } else {
                            setSelectedLanguage("English");
                            setLanguage("English");
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch user language:", error);
                    setSelectedLanguage("English");
                }
            }
        };

        await fetchLanguages();
        await fetchUserLanguage();
    };

    useEffect(() => {
        initializeContent();
    }, [userAddress]);

    useEffect(() => {
        const loadContent = async () => {
            await fetchLocalizedContent(selectedLanguage);
            setIsLoading(false);
        };

        if (selectedLanguage) {
            loadContent();
        }
    }, [selectedLanguage]);

    useEffect(() => {
        if (Object.keys(localizedContent).length > 0) {
            fetchReferralInfo();
        }
    }, [localizedContent]);

    const handleLanguageChange = async (event: ChangeEvent<HTMLSelectElement>) => {
        const newLanguage = event.target.value;
        setSelectedLanguage(newLanguage);
        setLanguage(newLanguage);
        await fetchLocalizedContent(newLanguage);

        if (userAddress) {
            try {
                await fetch('/api/set_user_language', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userAddress, language: newLanguage }),
                });
                //console.log(`Language set to ${newLanguage} for address ${userAddress}`);
            } catch (error) {
                console.error("Failed to set user language:", error);
            }
        }
    };

    const openModal = () => setModalIsOpen(true);
    const closeModal = () => setModalIsOpen(false);
    const copyToClipboard = () => {
        if (textareaRef.current) {
            textareaRef.current.select();
            document.execCommand('copy');
            toast.success(localizedContent.copyText || "Text has been copied to your clipboard. To share on social media, click the icon above and then paste the text into your post.", {
                autoClose: 10000
            });

        }
    };

    // Determine the current path
    const currentPath = router.pathname;

    // Add new state near other state declarations
    const [companyUsers, setCompanyUsers] = useState<{ userAddress: string; userName: string }[]>([]);

    // Add this useEffect to fetch company users
    useEffect(() => {
        const fetchCompanyUsers = async () => {
            if (userAddress) {
                try {
                    const response = await fetch(`/api/getCompanyUsers?userAddress=${encodeURIComponent(userAddress)}`);
                    if (response.ok) {
                        const data = await response.json();
                        setCompanyUsers(data.users || []);
                    }
                } catch (error) {
                    console.error('Error fetching company users:', error);
                }
            }
        };

        fetchCompanyUsers();
    }, [userAddress]);
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "4px",
                width: "100%",
            }}
        >
            <div style={{ display: "flex", alignItems: "center" }}>
                <div
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={() => {
                        let url = "";
                        if (selectedLanguage === "English") {
                            url = "https://youtu.be/wQs8p3skt8I";
                        } else if (selectedLanguage === "Español") {
                            url = "https://youtu.be/31bPyrbhl9A";
                        } else if (selectedLanguage === "中文") {
                            url = "https://youtu.be/TehYrtk1-Kw";
                        } else {
                            url = "https://youtu.be/-AXFSRNhpU4"; // Default to English if language is not recognized
                        }
                        window.open(url, "_blank", "noopener,noreferrer");
                    }}
                    style={{
                        cursor: "pointer",
                        position: "relative",
                        width: "120px",
                        height: "120px",
                    }}
                >
                    <Image
                        src="/images/omniagenthub_logo.jpeg"
                        alt="OmniAgentHub Logo"
                        width={120}
                        height={120}
                        layout="responsive"
                        className={styles.hoverLogo}
                    />
                    {isHovered && (
                        <div
                            style={{
                                position: "absolute",
                                bottom: "-20px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                backgroundColor: "black",
                                color: "white",
                                padding: "10px 20px",
                                borderRadius: "5px",
                                whiteSpace: "nowrap",
                                textAlign: "center",
                                zIndex: 1000,
                            }}
                        >
                            <LocalizedText name="Click to see the quick demo" />
                        </div>
                    )}
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        marginLeft: "1rem",
                        alignItems: "flex-start",
                    }}
                >
                    <button
                        onClick={openModal}
                        className={styles.shareButton}
                        onMouseEnter={() => setIsShareButtonHovered(true)}
                        onMouseLeave={() => setIsShareButtonHovered(false)}
                        style={{ position: "relative" }}
                    >
                        {localizedContent.shareButton}
                        {isShareButtonHovered && (
                            <div className={styles.tooltip}>
                                {localizedContent.referFriend}
                                {/*process.env.NEXT_PUBLIC_REFERRAL_BONUS}{" "}
                            {localizedContent.freeChats*/}
                            </div>
                        )}
                    </button>
                    <p></p>

                    {/* **Modified section with category dropdown and role name** */}
                    {freeChatsLeft !== null && (
                        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                            {/* Refill Button */}
                            <button
                                onClick={handleRefill}
                                className={styles.refillButton}
                                style={{
                                    backgroundColor: "blue",
                                    color: "white",
                                    padding: "5px 10px",
                                    borderRadius: "5px",
                                    cursor: "pointer",
                                }}
                            >
                                <LocalizedText name="Refill" />
                            </button>

                            {/* Balance Display - Shows USD and USDC (only if USDC > 0) */}
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ color: "#00ff88" }}>USD: ${(freeChatsLeft ?? 0).toFixed(2)}</span>
                                    {parseFloat(webaiBalance || '0') > 0 && (
                                        <>
                                            <span style={{ color: "#888" }}>|</span>
                                            <span style={{ color: "#4da6ff" }}>USDC: {webaiBalance}</span>
                                        </>
                                    )}
                                </span>
                                {/* Transfer Button */}
                                <button
                                    onClick={handleTransferClick}
                                    className={styles.transferButton}
                                    style={{
                                        backgroundColor: "green",
                                        color: "white",
                                        padding: "5px 10px",
                                        borderRadius: "5px",
                                        cursor: "pointer",
                                    }}
                                >
                                    <LocalizedText name="Transfer" />
                                </button>
                            </div>


                        </div>
                    )}
                </div>
            </div>

            {/* Middle Section - Navigation Links with Category/Roles Dropdowns */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                flex: 1,
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden'
            }}>

                {/* Navigation Links Row */}
                <div style={{ display: "flex", gap: "1rem" }}>
                    {/* Business Link */}
                    <Link
                        href="/ChatHome_bus"
                        style={{
                            color: (currentPath === "/ChatHome_bus") ? "white" : "#0096FF",
                            pointerEvents: (currentPath === "/ChatHome_bus") ? "none" : "auto",
                            cursor: (currentPath === "/ChatHome_bus") ? "default" : "pointer",
                            transition: "transform 0.2s ease",
                            display: "inline-block",
                        }}
                        className={`${styles.navLink}`}
                        aria-current={(currentPath === "/ChatHome_bus") ? "page" : undefined}
                    >
                        {(currentPath === "/ChatHome_bus") ? (
                            <LocalizedText name="Business" />
                        ) : (
                            <span className={styles.hoverScale}>
                                <LocalizedText name="Business" />
                            </span>
                        )}
                    </Link>

                    {/* Marketing Link */}
                    <Link
                        href="/ChatHome_new"
                        style={{
                            color: (currentPath === "/" || currentPath === "/ChatHome_new") ? "white" : "#0096FF",
                            pointerEvents: (currentPath === "/" || currentPath === "/ChatHome_new") ? "none" : "auto",
                            cursor: (currentPath === "/" || currentPath === "/ChatHome_new") ? "default" : "pointer",
                            transition: "transform 0.2s ease",
                            display: "inline-block",
                        }}
                        className={`${styles.navLink}`}
                        aria-current={(currentPath === "/" || currentPath === "/ChatHome_new") ? "page" : undefined}
                    >
                        {(currentPath === "/" || currentPath === "/ChatHome_new") ? (
                            <LocalizedText name="Entrepreneur"></LocalizedText>
                        ) : (
                            <span className={styles.hoverScale}>
                                <LocalizedText name="Entrepreneur"></LocalizedText>
                            </span>
                        )}
                    </Link>


                </div>

                {/* Category and Roles Dropdowns Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    flexWrap: 'nowrap',
                    justifyContent: 'center'
                }}>
                    {/* Category Dropdown */}
                    <div style={{ position: "relative" }}>
                        <select
                            value={selectedCategory}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            style={{
                                padding: "8px 12px",
                                borderRadius: "6px",
                                border: "2px solid #0096FF",
                                backgroundColor: "#0096FF",
                                color: "white",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "bold",
                                minWidth: "120px",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            }}
                        >
                            {categories.map((category) => (
                                <option
                                    key={category}
                                    value={category}
                                    style={{
                                        backgroundColor: "#0096FF",
                                        color: "white",
                                    }}
                                >
                                    <LocalizedText name={category} />
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

            </div>


            {/* Right Section - Controls */}
            <div style={{ display: "flex", alignItems: "center" }}>
                {/* **New "Ask AI" Button for Business Model** */}
                <button
                    className={styles.askAiButton}
                    onClick={() => {
                        console.log('Ask AI button clicked');
                        openChat();
                    }}
                    aria-label="Ask AI"
                    onMouseEnter={() => setIsAskAiHovered(true)}
                    onMouseLeave={() => setIsAskAiHovered(false)}
                    style={{ position: "relative" }}
                >
                    <LocalizedText name="Ask AI" />
                    {isAskAiHovered && (
                        <div className={styles.tooltip}>
                            <LocalizedText name="Ask AI to identify tasks for your objectives" />
                        </div>
                    )}
                </button>


                <select
                    style={{
                        padding: "0.5rem 1rem",
                        border: "2px solid #444",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor: "blue",
                        color: "white",
                        width: "150px",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                        fontSize: "18px",
                        marginRight: "1rem",
                    }}
                    value={selectedLanguage}
                    onChange={handleLanguageChange}
                >
                    {languages.map((language) => (
                        <option
                            key={language}
                            value={language}
                            style={{
                                backgroundColor: "#0096FF",
                                color: "white",
                                padding: "10px 20px",
                            }}
                        >
                            {language}
                        </option>
                    ))}
                </select>

                {/* Privy Login/Logout - Enhanced Avatar Dropdown */}
                {authLoading ? (
                    <div style={{ padding: '10px 20px', color: 'white' }}>
                        <LocalizedText name="Loading..." />
                    </div>
                ) : userAddress ? (
                    // User is logged in - show avatar with dropdown menu on click
                    <>
                        {/* Backdrop overlay when dropdown is open */}
                        {isAvatarDropdownOpen && (
                            <div
                                onClick={() => setIsAvatarDropdownOpen(false)}
                                style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                    zIndex: 9998,
                                }}
                            />
                        )}
                        <div style={{ position: 'relative', zIndex: 9999 }}>
                            {/* Avatar Image - Click to toggle dropdown */}
                            <div
                                onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                                onMouseEnter={() => setIsAvatorHovered(true)}
                                onMouseLeave={() => setIsAvatorHovered(false)}
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '50%',
                                    backgroundImage: 'url(/images/avatar.jpg)',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                    transform: isAvatorHovered ? 'scale(1.1)' : 'scale(1)',
                                    boxShadow: isAvatorHovered
                                        ? '0 8px 20px rgba(0, 150, 255, 0.6)'
                                        : '0 4px 10px rgba(0, 0, 0, 0.3)',
                                }}
                            />

                            {/* Tooltip on hover (only when dropdown is closed) */}
                            {isAvatorHovered && !isAvatarDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '-35px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                                    color: 'white',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    whiteSpace: 'nowrap',
                                    zIndex: 10000,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                }}>
                                    <LocalizedText name="Click to view account" />
                                </div>
                            )}

                            {/* Dropdown Menu - Opens on click */}
                            {isAvatarDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: '70px',
                                    right: '0',
                                    backgroundColor: '#1a1a2e',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    minWidth: '280px',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    zIndex: 10000,
                                }}>
                                    {/* Wallet Address */}
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: 'rgba(0, 150, 255, 0.1)',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                    }}>
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                            <LocalizedText name="Wallet Address" />
                                        </div>
                                        <div style={{
                                            fontSize: '13px',
                                            color: '#fff',
                                            fontFamily: 'monospace',
                                            wordBreak: 'break-all',
                                        }}>
                                            {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(userAddress);
                                                toast.success('Address copied!');
                                            }}
                                            style={{
                                                marginTop: '8px',
                                                padding: '4px 8px',
                                                fontSize: '10px',
                                                backgroundColor: '#0096FF',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            📋 <LocalizedText name="Copy" />
                                        </button>
                                    </div>

                                    {/* Email Address */}
                                    {privyUser?.email?.address || privyUser?.google?.email ? (
                                        <div style={{
                                            padding: '12px',
                                            backgroundColor: 'rgba(255, 200, 0, 0.1)',
                                            borderRadius: '8px',
                                            marginBottom: '12px',
                                        }}>
                                            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                                <LocalizedText name="Email" />
                                            </div>
                                            <div style={{
                                                fontSize: '13px',
                                                color: '#fff',
                                                wordBreak: 'break-all',
                                            }}>
                                                {privyUser?.email?.address || privyUser?.google?.email || ''}
                                            </div>
                                        </div>
                                    ) : null}

                                    {/* Balance Section */}
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: 'rgba(0, 255, 150, 0.05)',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                    }}>
                                        <div style={{ fontSize: '14px', color: 'white', marginBottom: '10px', fontWeight: 'bold' }}>
                                            <LocalizedText name="Balance" />
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '6px',
                                        }}>
                                            <span style={{ color: '#aaa', fontSize: '13px' }}>USD</span>
                                            <span style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '14px' }}>
                                                ${freeChatsLeft ?? 0}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}>
                                            <span style={{ color: '#aaa', fontSize: '13px' }}>USDC</span>
                                            <span style={{ color: '#4da6ff', fontWeight: 'bold', fontSize: '14px' }}>
                                                {webaiBalance || '0.00'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => window.open(`https://sepolia.basescan.org/address/${userAddress}`, '_blank')}
                                            style={{
                                                width: '100%',
                                                marginTop: '8px',
                                                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                                border: '1px solid rgba(59, 130, 246, 0.5)',
                                                borderRadius: '4px',
                                                color: '#3b82f6',
                                                padding: '6px',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <span style={{ fontSize: '14px' }}>📜</span>
                                            USDC Transaction
                                        </button>
                                    </div>

                                    {/* Currency Preference Selector */}
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: 'rgba(0, 150, 255, 0.05)',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                    }}>
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                                            <LocalizedText name="Use First" />
                                        </div>
                                        <div style={{ display: 'flex', gap: '16px' }}>
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer',
                                                color: 'white',
                                                fontSize: '13px'
                                            }}>
                                                <input
                                                    type="radio"
                                                    name="paymentPreferenceBusiness"
                                                    value="usd"
                                                    defaultChecked={(localStorage.getItem('preferredPaymentMode') || 'usd') === 'usd'}
                                                    onChange={async (e) => {
                                                        if (e.target.checked) {
                                                            const preference = 'usd';
                                                            console.log('🔄 Payment preference changed:', preference);
                                                            localStorage.setItem('preferredPaymentMode', preference);
                                                            window.dispatchEvent(new CustomEvent('paymentModeChanged'));
                                                            try {
                                                                const walletAddr = userAddress || '';
                                                                if (walletAddr) {
                                                                    await fetch('/api/set-payment-preference', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ userAddress: walletAddr, preference })
                                                                    });
                                                                    console.log('✅ Payment preference saved to KV:', preference);
                                                                }
                                                            } catch (err) {
                                                                console.error('Failed to save preference:', err);
                                                            }
                                                        }
                                                    }}
                                                    style={{ accentColor: '#00ff88' }}
                                                />
                                                USD
                                            </label>
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer',
                                                color: 'white',
                                                fontSize: '13px'
                                            }}>
                                                <input
                                                    type="radio"
                                                    name="paymentPreferenceBusiness"
                                                    value="usdc"
                                                    defaultChecked={localStorage.getItem('preferredPaymentMode') === 'usdc'}
                                                    onChange={async (e) => {
                                                        if (e.target.checked) {
                                                            const preference = 'usdc';
                                                            console.log('🔄 Payment preference changed:', preference);
                                                            localStorage.setItem('preferredPaymentMode', preference);
                                                            window.dispatchEvent(new CustomEvent('paymentModeChanged'));
                                                            try {
                                                                const walletAddr = userAddress || '';
                                                                if (walletAddr) {
                                                                    await fetch('/api/set-payment-preference', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ userAddress: walletAddr, preference })
                                                                    });
                                                                    console.log('✅ Payment preference saved to KV:', preference);
                                                                }
                                                            } catch (err) {
                                                                console.error('Failed to save preference:', err);
                                                            }
                                                        }
                                                    }}
                                                    style={{ accentColor: '#0096FF' }}
                                                />
                                                USDC
                                            </label>
                                        </div>
                                    </div>

                                    {/* Network Info */}
                                    <div style={{
                                        padding: '12px',
                                        backgroundColor: 'rgba(128, 0, 255, 0.05)',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                    }}>
                                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                                            <LocalizedText name="Network" />
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}>
                                            <div style={{
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                backgroundColor: '#00ff88',
                                            }} />
                                            <span style={{ color: '#fff', fontSize: '13px' }}>
                                                {activeChain?.name || 'Base Sepolia'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsAvatarDropdownOpen(false);
                                                handleRefill();
                                            }}
                                            style={{
                                                padding: '10px 16px',
                                                backgroundColor: '#0096FF',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            💳 <LocalizedText name="Refill Balance" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsAvatarDropdownOpen(false);
                                                window.open(`https://sepolia.basescan.org/address/${userAddress}`, '_blank');
                                            }}
                                            style={{
                                                padding: '10px 16px',
                                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                color: 'white',
                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            📜 <LocalizedText name="USDC Transaction" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open('https://faucet.circle.com/', '_blank');
                                            }}
                                            style={{
                                                padding: '10px 16px',
                                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                color: 'white',
                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            🚰 <LocalizedText name="Get Test USDC" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsAvatarDropdownOpen(false);
                                                setIsHistoryModalOpen(true);
                                            }}
                                            style={{
                                                padding: '10px 16px',
                                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                                color: 'white',
                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            🕐 <LocalizedText name="USD Transaction" />
                                        </button>
                                        <div style={{
                                            height: '1px',
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            margin: '4px 0',
                                        }} />
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsAvatarDropdownOpen(false);
                                                handleLogout();
                                            }}
                                            style={{
                                                padding: '10px 16px',
                                                backgroundColor: 'rgba(255, 68, 68, 0.1)',
                                                color: '#ff4444',
                                                border: '1px solid rgba(255, 68, 68, 0.3)',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            🚪 <LocalizedText name="Sign Out" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    // User not logged in - show Sign In button
                    <button
                        onClick={() => privyLogin()}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#0096FF',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: '600',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#0077CC';
                            e.currentTarget.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#0096FF';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <LocalizedText name="Sign In" />
                    </button>
                )}

            </div>

            {/* All Modals remain the same */}
            {/* Share Modal */}
            <Modal
                isOpen={modalIsOpen}
                onRequestClose={closeModal}
                className={styles.modal}
                overlayClassName={styles.overlay}
            >
                <h2 className={styles.modalTitle}>{localizedContent.modalTitle}</h2>
                <div className={styles.socialIcons}>
                    {/* Twitter Icon */}
                    <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                            redditMessage
                        )}&url=${encodeURIComponent("https://web3aistore.com")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.iconx}
                        onClick={(e) => {
                            e.preventDefault();
                            copyToClipboard();
                            setTimeout(() => {
                                window.open(
                                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                                        redditMessage
                                    )}&url=${encodeURIComponent("https://web3aistore.com")}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                );
                            }, 100);
                        }}
                    >
                        <FontAwesomeIcon icon={faTwitter} size="2x" />
                    </a>

                    {/* Facebook Icon */}
                    <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                            "https://web3aistore.com"
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.iconf}
                        onClick={(e) => {
                            e.preventDefault();
                            copyToClipboard();
                            setTimeout(() => {
                                window.open(
                                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                                        "https://web3aistore.com"
                                    )}&quote=${encodeURIComponent(redditMessage)}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                );
                            }, 100);
                        }}
                    >
                        <FontAwesomeIcon icon={faFacebookF} size="2x" />
                    </a>

                    {/* LinkedIn Icon */}
                    <a
                        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                            "https://web3aistore.com"
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.iconl}
                        onClick={(e) => {
                            e.preventDefault();
                            copyToClipboard();
                            setTimeout(() => {
                                window.open(
                                    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                                        "https://web3aistore.com"
                                    )}`,
                                    "_blank",
                                    "noopener,noreferrer"
                                );
                            }, 100);
                        }}
                    >
                        <FontAwesomeIcon icon={faLinkedinIn} size="2x" />
                    </a>

                    {/* Reddit Icon */}
                    {referralLink && (
                        <a
                            href={`https://www.reddit.com/submit?link_url=${encodeURIComponent(
                                referralLink
                            )}&title=${encodeURIComponent(redditMessage)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.iconr}
                            onClick={(e) => {
                                e.preventDefault();
                                copyToClipboard();
                                setTimeout(() => {
                                    window.open(
                                        `https://www.reddit.com/submit?link_url=${encodeURIComponent(
                                            referralLink
                                        )}&title=${encodeURIComponent(redditMessage)}`,
                                        "_blank",
                                        "noopener,noreferrer"
                                    );
                                }, 100);
                            }}
                        >
                            <FontAwesomeIcon icon={faReddit} size="2x" />
                        </a>
                    )}
                </div>

                <p
                    style={{
                        textAlign: "center",
                        margin: "10px 0",
                        fontSize: "18px",
                        color: "#0096FF",
                    }}
                >
                    {localizedContent.copyText}
                </p>
                <textarea
                    ref={textareaRef}
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    className={styles.textarea}
                />
                <div className={styles.buttonContainer}>
                    <button className={styles.copyButton} onClick={copyToClipboard}>
                        {localizedContent.copyButton}
                    </button>
                    <button className={styles.closeButton1} onClick={closeModal}>
                        {localizedContent.closeButton}
                    </button>
                </div>
            </Modal>

            {/* History Modal */}
            <HistoryModal
                isOpen={isHistoryModalOpen}
                onRequestClose={() => setIsHistoryModalOpen(false)}
                userAddress={userAddress || ''}
            />

            {/* Refill Modal */}
            <Modal
                isOpen={isRefillModalOpen}
                onRequestClose={() => setIsRefillModalOpen(false)}
                className={styles.refillModalContent}
                overlayClassName={styles.refillModalOverlay}
                contentLabel="Refill Modal"
            >
                {/* Close Button */}
                <button
                    className={styles.refillCloseButton}
                    onClick={() => setIsRefillModalOpen(false)}
                    aria-label="Close Refill Modal"
                >
                    &times;
                </button>

                {/* Modal Title */}
                <h2 className={styles.refillModalTitle}>
                    <LocalizedText name="Select a Refill Pack" />
                </h2>

                {/* Scrollable Product List */}
                <div className={styles.productListContainer}>
                    <div className={styles.productList}>
                        {/* Existing product list */}
                        {products.map((product) => {
                            // Get discount rate for this product (or use default)
                            const discountRate = (() => {
                                if (userCoupons && userCoupons[product.id]) {
                                    return userCoupons[product.id] / 100; // Convert percentage to decimal
                                }
                                // Default discounts if no coupon exists
                                switch (product.id) {
                                    case 1: return 0.2; // 20% discount
                                    case 2: return 0.4; // 40% discount
                                    case 3: return 0.3; // 30% discount
                                    default: return 0;
                                }
                            })();

                            // Calculate discounted price
                            const originalPrice = parseFloat(product.price.replace(/[^0-9.-]+/g, ""));
                            const discountedPrice = (originalPrice * (1 - discountRate)).toFixed(2);
                            const discountPercentage = Math.round(discountRate * 100);

                            return (
                                <div key={product.id} className={styles.productItem}>
                                    {/* Top Section: Image and Action */}
                                    <div className={styles.productTopSection}>
                                        {/* Left Side: Product Image */}
                                        <div className={styles.productImageContainer}>
                                            <Image
                                                src={product.imageUrl}
                                                alt={product.title}
                                                width={150}
                                                height={150}
                                                className={styles.productImage}
                                            />
                                        </div>

                                        {/* Right Side: Price, Total Value, Buy Button */}
                                        <div className={styles.productAction}>
                                            <p>
                                                <strong>
                                                    <LocalizedText name="Price" />:
                                                </strong>{" "}
                                                <span style={{
                                                    textDecoration: 'line-through',
                                                    textDecorationThickness: '2px',
                                                    textDecorationStyle: 'solid',
                                                    textDecorationColor: 'currentColor',
                                                    transform: 'rotate(5deg)',
                                                    display: 'inline-block'
                                                }}>
                                                    {product.price}
                                                </span>{" "}
                                                <span style={{ color: 'red' }}>
                                                    ${discountedPrice} ({discountPercentage}% off)
                                                </span>
                                            </p>
                                            <p>
                                                <strong>
                                                    <LocalizedText name="Total Value" />:
                                                </strong>{" "}
                                                {product.totalValue}
                                            </p>
                                            <button
                                                className={styles.buyNowButton}
                                                onClick={() => handlePurchase(product)}
                                            >
                                                <LocalizedText name="Buy Now" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom Section: Details */}
                                    <div className={styles.productDetails}>
                                        {/* Product Title */}
                                        <h3 className={styles.productTitle}>
                                            <LocalizedText name={product.title} />
                                        </h3>

                                        {/* Product Description */}
                                        <p className={styles.productDescription}>
                                            <LocalizedText name={product.description} />
                                        </p>

                                        {/* Included Items */}
                                        <ul className={styles.includedItems}>
                                            {product.includedItems.map((item, index) => (
                                                <li key={index}>
                                                    <LocalizedText name={item} />
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>

            {/* Transfer Modal */}
            <Modal
                isOpen={isTransferModalOpen}
                onRequestClose={() => setIsTransferModalOpen(false)}
                className={styles.transferModalContent}
                overlayClassName={styles.transferModalOverlay}
                contentLabel="Transfer Credits Modal"
            >
                {/* Close Button */}
                <button
                    className={styles.transferCloseButton}
                    onClick={() => setIsTransferModalOpen(false)}
                    aria-label="Close Transfer Modal"
                >
                    &times;
                </button>

                {/* Modal Title */}
                <h2 className={styles.transferModalTitle}>
                    <LocalizedText name="Transfer Credits" />
                </h2>

                {/* From Address Section */}
                <div className={styles.fromAddressContainer}>
                    <span><LocalizedText name="My Account Address" />:</span>
                    <p></p>
                    <div className={styles.userAddress}>
                        <span>{userAddress}</span>
                        <button
                            className={styles.copyButton1}
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(userAddress || '');
                                    const message = 'Address copied to clipboard!';
                                    const localizedMessage = await getLocalizedString(message, language);
                                    toast.success(localizedMessage);
                                } catch (error) {
                                    toast.error('Failed to copy address.');
                                }
                            }}
                            aria-label="Copy Address"
                        >
                            <LocalizedText name="Copy" />
                        </button>
                    </div>
                </div>

                {/* Transfer Form */}
                <div className={styles.transferForm}>
                    {/* Destination Address Input */}
                    <label>
                        <LocalizedText name="Transfer To" />:
                    </label>
                    <select
                        value={transferAddress}
                        onChange={(e) => setTransferAddress(e.target.value)}
                        className={styles.transferInput}
                    >
                        <option value=""><LocalizedText name="Select a user"></LocalizedText></option>
                        {companyUsers.map((user) => (
                            <option key={user.userAddress} value={user.userAddress}>
                                {user.userName} ({user.userAddress.slice(0, 6)}...{user.userAddress.slice(-4)})
                            </option>
                        ))}
                    </select>

                    {/* Credit Amount to Transfer */}
                    <label>
                        <LocalizedText name="Available Credits" />: <strong>${freeChatsLeft ?? 0}</strong>
                    </label>

                    {/* Transfer Amount Input */}
                    <div className={styles.transferAmountContainer}>
                        <div className={styles.transferAmount}>
                            <span><LocalizedText name="Amount to Transfer" /> ($):</span>
                            <input
                                type="number"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(Number(e.target.value))}
                                className={styles.transferAmountInput}
                                min="0.01"
                                step="0.01"
                                max={freeChatsLeft ?? 0}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <p></p>

                    {/* Transfer Buttons */}
                    <div className={styles.transferButtonContainer}>
                        <button
                            className={styles.transferSubmitButton}
                            onClick={handleTransferSubmit}
                            disabled={isTransferring || !transferAddress || transferAmount <= 0}
                        >
                            {isTransferring ? (
                                <LocalizedText name="Transferring..." />
                            ) : (
                                <LocalizedText name="Transfer" />
                            )}
                        </button>
                        <button
                            className={styles.transferCancelButton}
                            onClick={() => setIsTransferModalOpen(false)}
                        >
                            <LocalizedText name="Cancel" />
                        </button>
                    </div>
                </div>
            </Modal>





        </div >
    );

};

export default Navbar;
