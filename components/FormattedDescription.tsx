// components/FormattedDescription.tsx

import React from 'react';
import { formatDescription, FormattedDescription as FormattedDescriptionType } from '../util/formatDescription';
import styles from '../styles/FormattedDescription.module.css'; // Ensure this CSS module exists

interface FormattedDescriptionProps {
    description: string;
}

const FormattedDescription: React.FC<FormattedDescriptionProps> = ({ description }) => {
    const { introText, items } = formatDescription(description);

    return (
        <div className={styles.container}>
            {introText && <p className={styles.intro}>{introText}</p>}
            {items.length > 0 && (
                <ol className={styles.orderedList}>
                    {items.map((item, index) => (
                        <li key={index} className={styles.listItem}>
                            <strong>{item.title}:</strong> {item.content}
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
};

export default FormattedDescription;
