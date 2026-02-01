import React, { useState, useContext } from 'react';
import styles from '../styles/RatingComponent.module.css';
import { getLocalizedString, LocalizedText } from '../util/LocalizedText';
import { LocalizationContext } from '../util/LocalizationContext';
import { useActiveAccount } from '../hooks/useWalletAddress';
import { toast } from 'react-toastify';

interface StarRatingProps {
    rating: number;
    setRating: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, setRating }) => {
    const handleStarClick = (ratingValue: number) => {
        setRating(ratingValue === rating ? 0 : ratingValue);
    };

    return (
        <div>
            {[...Array(5)].map((_, index) => {
                const ratingValue = index + 1;
                return (
                    <button
                        key={ratingValue}
                        className={ratingValue <= rating ? styles.on : styles.off}
                        onClick={() => handleStarClick(ratingValue)}
                        aria-label={`Rate ${ratingValue} out of 5`}
                    >
                        <span className={ratingValue <= rating ? styles.on : styles.off}>&#9733;</span>
                    </button>
                );
            })}
        </div>
    );
};

interface RatingComponentProps {
    isOpen?: boolean; // Optional with default
    tokenId: string;
    department: string;
    role: string;
    onClose: () => void;
    userAddress?: string;
}

const RatingComponent: React.FC<RatingComponentProps> = ({ tokenId, department, role, onClose, isOpen = true }) => {
    // ✅ FIXED: All hooks moved to the top level - before any conditional logic
    const [rating, setRating] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const address = useActiveAccount()?.account?.address;
    const { language, setLanguage } = useContext(LocalizationContext);

    const handleRate = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/addRating', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: address, department, role, rating })
            });

            if (!response.ok) {
                throw new Error('Failed to submit rating');
            }

            const staticMessage = "Rating submitted successfully for persona:";
            const localizedStaticMessage = await getLocalizedString(staticMessage, language);
            const localizeTokenId = await getLocalizedString(tokenId, language);
            const message = `${localizedStaticMessage} ${localizeTokenId}`;
            toast.info(message);

            onClose();
        } catch (error) {
            console.error("Error submitting rating:", error);
            const message = 'Failed to submit rating';
            toast.info(await getLocalizedString(message, language));
        } finally {
            setIsLoading(false);
        }
    };

    // ✅ FIXED: Conditional rendering moved to JSX return instead of early return
    if (!isOpen) {
        return null;
    }

    return (
        <div className={styles.modal}>
            <div className={styles.modalContent}>
                <h3 className={styles.title}>
                    <LocalizedText name="Rate this GPT" />
                </h3>
                <StarRating rating={rating} setRating={setRating} />
                <div>
                    <button
                        onClick={handleRate}
                        disabled={isLoading || rating === 0}
                        className={styles.button}
                    >
                        {isLoading ? (
                            <LocalizedText name="Submitting..." />
                        ) : (
                            <LocalizedText name="Submit Rating" />
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        className={`${styles.button} ${styles.closemodal}`}
                    >
                        <LocalizedText name="Close" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RatingComponent;
