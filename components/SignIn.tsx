import React, { useState, useEffect, useContext, ChangeEvent } from "react";
import { useRouter } from 'next/router';
import Image from "next/image";
import { usePrivy } from '@privy-io/react-auth';
import { LocalizedText, LocalizedText1 } from '../util/LocalizedText';
import { LocalizationContext } from '../util/LocalizationContext';
import styles from "../styles/Signin.module.css";
import HashUtil from "../util/hashToFixedDigits";
import { toast } from 'react-toastify';
import OpenWebsiteToast from '../components/OpenWebsiteToast';

/**
 * SignIn Component
 * 
 * MIGRATED: From Auth0 to Privy authentication
 * Uses Privy's built-in login modal with embedded wallets
 *
 */
const SignIn = () => {
    const router = useRouter();
    const { query } = router;
    const { login, ready, authenticated } = usePrivy();

    const [languages, setLanguages] = useState<string[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<string>("English");
    const [isHovered, setIsHovered] = useState(false);
    const { setLanguage } = useContext(LocalizationContext);
    const [email, setEmail] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Redirect to home if already authenticated
    useEffect(() => {
        if (ready && authenticated) {
            // Only redirect if we are on the landing page or explicit sign-in page
            // If we are on a deep link (like /ChatHome_bus), stay there and let the page render content
            if (router.pathname === '/' || router.pathname === '/SignIn' || router.pathname === '/login') {
                console.log('✅ User authenticated on landing page, redirecting to home...');
                router.push('/');
            } else {
                console.log('✅ User authenticated on deep link, preserving current path...');
            }
        }
    }, [ready, authenticated, router]);

    useEffect(() => {
        const fetchLanguages = async () => {
            try {
                const response = await fetch('/api/get_all_languages');
                if (response.ok) {
                    const langs: string[] = await response.json();
                    setLanguages(Array.from(new Set(langs)));
                } else {
                    console.error("Failed to fetch languages");
                    setLanguages(["English"]);
                }
            } catch (error) {
                console.error("Error fetching languages:", error);
                setLanguages(["English"]);
            }
        };

        const initialize = async () => {
            await fetchLanguages();
            const lang = typeof query.lang === 'string' ? query.lang : "English";
            setSelectedLanguage(lang);
            setLanguage(lang);
        };
        initialize();
    }, [query.lang, setLanguage]);

    const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const newLanguage = event.target.value;
        setSelectedLanguage(newLanguage);
        setLanguage(newLanguage);
        router.push({
            pathname: router.pathname,
            query: { ...router.query, lang: newLanguage },
        }, undefined, { shallow: false });
    };

    useEffect(() => {
        let toastTimer: NodeJS.Timeout;

        toastTimer = setTimeout(() => {
            const handleOpen = () => {
                window.open("https://omniagenthub.vercel.app/home");
                toast.dismiss('open-website-toast');
            };

            toast(
                <OpenWebsiteToast onOpen={handleOpen} />,
                {
                    toastId: 'open-website-toast',
                    position: "top-center",
                    autoClose: 10000,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: false,
                    draggable: true,
                    theme: "dark",
                }
            );
        }, 300000);

        return () => {
            if (toastTimer) {
                clearTimeout(toastTimer);
            }
        };
    }, []);

    const handleEmailSubmit = async () => {
        if (!email) {
            alert("Please enter your email address.");
            return;
        }

        try {
            setIsSubmitting(true);
            const hashedEmail = HashUtil.hashTo(email);
            const baseUrl = `${window.location.origin}/?promoteCode=${hashedEmail}:prom40`;
            const sharedMessage = `AI Won't Replace You—It Will Unlock Your Full Potential!<br><br>We invite you to experience the power of AI to boost productivity and enhance self-development.<br><br>Click the link below to get:<br><br>✅ 20 WEBAI Credits — good for 2,000+ chats and uploads!<br><br>👉  <a clicktracking=off href="${baseUrl}">${baseUrl}</a> <br><br>Getting started is easy! Simply log in with social login, enter your name and company, and click Ask AI.<br><br>Input any task—like 'write me a business plan'—then choose the best AI tool for your needs.<br><br>Use the Knowledge Base to upload relevant content or web scrape your website to enrich AI results.<br><br>AI will ask 5 key questions, guiding you with insights from your selected knowledge sources to generate an instant first draft, which you can refine for the best final result.<br><br>Plus, you can share free perks, transfer knowledge sources, and collaborate across your organization.<br><br>Start now and unlock the future of AI-powered efficiency! 🚀`;

            const response = await fetch("/api/sendEmail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipient: email,
                    subject: "Your Exclusive AI Offer",
                    message: sharedMessage,
                    sender: "eric@omniagenthub.ai",
                    html: sharedMessage,
                    fromDisplay: "Eric From OmniAgentHub",
                    replyTo: "eric@omniagenthub.ai",
                }),
            });

            if (response.ok) {
                alert("Email sent successfully! Please check your inbox.");
                setEmail("");
            } else {
                alert("Failed to send email. Please try again later.");
            }
        } catch (error) {
            console.error("Error submitting email:", error);
            alert("An error occurred while sending the email.");
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Handle Privy login
     * Opens the Privy modal with all configured login methods
     */
    const handleLogin = () => {
        console.log('🔐 Opening Privy login modal...');
        login();
    };

    return (
        <div className={styles.signInContainer}>
            {/* Header Container with Flexbox */}
            <div className={styles.header}>
                {/* Logo Container */}
                <div className={styles.logoContainer}>
                    <div
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        onClick={() =>
                            window.open(
                                "https://omniagenthub.vercel.app",
                                "_blank",
                                "noopener,noreferrer"
                            )
                        }
                        className={styles.logoWrapper}
                    >
                        <Image
                            src="/images/omniagenthub_logo.jpeg"
                            alt="OmniAgentHub Logo"
                            fill
                            className={styles.hoverLogo}
                            priority
                        />
                        {isHovered && (
                            <div className={styles.hoverTooltip}>
                                <LocalizedText name="Click to see the website" />
                            </div>
                        )}
                    </div>
                    <a
                        href="https://omniagenthub.vercel.app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.visitWebsiteLink}
                    >
                        <LocalizedText name="Website You Trust" />
                    </a>
                </div>

                {/* Language Dropdown */}
                <div className={styles.languageContainer}>
                    <select
                        className={styles.languageSelect}
                        value={selectedLanguage}
                        onChange={handleLanguageChange}
                    >
                        {languages.map(language => (
                            <option key={language} value={language}>
                                {language}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Welcome Message */}
            <h1 className={styles.welcomeMessage}>
                <a
                    href="https://omniagenthub.vercel.app/home"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.welcomeLink}
                >
                    <LocalizedText name="Unlock the Power of AI with OmniAgentHub" />
                </a>
            </h1>

            {/* Tagline */}
            <p className={styles.tagline}>
                <LocalizedText name="Effortless AI Solutions to Boost Productivity and Gain an Edge in Work and Life" />
            </p>

            {/* Centered Award Section with Animation */}
            <div className={styles.heroSection}>
                {/* Award Badge Container with Marquee Background */}
                <div className={styles.awardContainer}>
                    {/* Marquee Text Behind Badge */}
                    <div className={styles.marqueeWrapper}>
                        <div className={styles.marqueeTrack}>
                            <span className={styles.marqueeText}>Innovation of the Year</span>
                            <span className={styles.marqueeText}>Innovation of the Year</span>
                            <span className={styles.marqueeText}>Innovation of the Year</span>
                        </div>
                    </div>

                    {/* Award Badge */}
                    <a
                        href="https://omniagenthub.vercel.app/home#award"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View Innovation Award"
                        className={styles.awardLink}
                    >
                        <div className={styles.awardGlow}>
                            <Image
                                src="/images/award-logo.png"
                                alt="Innovation & Excellence Award 2025"
                                width={200}
                                height={200}
                                className={styles.awardBadge}
                                priority
                            />
                        </div>
                    </a>
                </div>

                {/* Sign In Button Below Award */}
                <button
                    onClick={handleLogin}
                    className={styles.primaryButton}
                >
                    <span className={styles.buttonIcon}>🔐</span>
                    <LocalizedText name="Sign In / Sign Up" />
                </button>
            </div>

            {/* Quick Demo Buttons */}
            <div className={styles.quickDemoContainer}>
                <a
                    href="https://www.youtube.com/watch?v=hOvMC7IY8CQ"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.quickDemoLink}
                >
                    <button className={styles.quickDemoButton}>About Us</button>
                </a>
                <a
                    href="https://youtu.be/wQs8p3skt8I"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.quickDemoLink}
                >
                    <button className={styles.quickDemoButton}>Quick Demo</button>
                </a>
                <a
                    href="https://youtu.be/31bPyrbhl9A"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.quickDemoLink}
                >
                    <button className={styles.quickDemoButton}>Demostración Rápida</button>
                </a>
                <a
                    href="https://youtu.be/TehYrtk1-Kw"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.quickDemoLink}
                >
                    <button className={styles.quickDemoButton}>快速演示</button>
                </a>
            </div>

            {/* Email Submit Section */}
            <div style={{ marginTop: "20px", textAlign: "center" }}>
                <label htmlFor="email" style={{ marginBottom: "20px", marginRight: "20px" }}>
                    <LocalizedText name="Enter Your Email Address:" />
                </label>
                <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    style={{
                        padding: "10px",
                        width: "300px",
                        borderRadius: "5px",
                        border: "1px solid #ccc",
                        marginBottom: "20px",
                        marginRight: "20px"
                    }}
                />
                <button
                    onClick={handleEmailSubmit}
                    disabled={isSubmitting}
                    style={{
                        padding: "10px 20px",
                        backgroundColor: "#007bff",
                        color: "#fff",
                        borderRadius: "5px",
                        border: "none",
                        cursor: isSubmitting ? "not-allowed" : "pointer",
                    }}
                >
                    {isSubmitting ? <LocalizedText1 name="Submitting..." /> : <LocalizedText1 name="Send Me The Link" />}
                </button>
            </div>

            {/* Instructional Text */}
            <p className={styles.instructionText1}>
                <LocalizedText name="Experience a smarter way to use AI in your daily work. Enter your email to receive 20 WEBAI credits—good for 2,000+ chats and uploads—totally free, no credit card required. Turn your documents or website into a personalized AI knowledge base. OmniAgentHub offers 5,500+ AI tools for real-world business tasks, supporting the seven most spoken languages. Powered by GPT-4o, one of the most advanced AI APIs available, our platform delivers fast, reliable performance. Our self-learning agents improve with user feedback, expert input, and focus group simulation to provide increasingly accurate, customized results." />
            </p>
        </div>
    );
};

export default SignIn;
