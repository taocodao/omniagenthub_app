// pages/insufficient-payment.tsx

import React from 'react';

const InsufficientPayment: React.FC = () => {
    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Insufficient Payment</h1>
            <p style={styles.message}>
                Your payment could not be processed due to insufficient funds. Please ensure you have enough balance and try again.
            </p>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8d7da',
        color: '#721c24',
        padding: '20px',
        textAlign: 'center',
    },
    title: {
        fontSize: '3rem',
        marginBottom: '20px',
    },
    message: {
        fontSize: '1.5rem',
    },
};

export default InsufficientPayment;
