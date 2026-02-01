
import React, { useEffect, useState } from 'react';
import Modal from 'react-modal';
import { LocalizedText } from '../util/LocalizedText';

// Matches the backend transaction structure from kvPayment.ts
interface Transaction {
    timestamp: string;
    mcpServer?: string;
    endpoint?: string;
    creditsUsed?: number;
    priceUsd?: number;
    balanceAfter?: number;
    payer?: string;
    resource?: string;
    status?: string;
    // Added for X402/USDC transactions
    paymentMethod?: string; // 'USDC' or 'WEBAI'
    txHash?: string;
    network?: string;
}

interface HistoryModalProps {
    isOpen: boolean;
    onRequestClose: () => void;
    userAddress: string;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onRequestClose, userAddress }) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && userAddress) {
            fetchTransactions();
        }
    }, [isOpen, userAddress]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/get-user-transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.transactions)) {
                    setTransactions(data.transactions);
                }
            } else {
                console.error('Failed to fetch transactions');
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString();
        } catch (e) {
            return dateString;
        }
    };

    // Get display amount - try multiple field names
    const getAmount = (tx: Transaction): number => {
        if (typeof tx.priceUsd === 'number' && !isNaN(tx.priceUsd)) return tx.priceUsd;
        if (typeof tx.creditsUsed === 'number' && !isNaN(tx.creditsUsed)) return tx.creditsUsed * 0.01; // Convert credits to USD
        return 0;
    };

    // Get display name for the transaction
    const getDisplayName = (tx: Transaction): string => {
        return tx.resource || tx.endpoint || tx.mcpServer || 'Transaction';
    };

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onRequestClose}
            style={{
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    zIndex: 10000,
                },
                content: {
                    top: '50%',
                    left: '50%',
                    right: 'auto',
                    bottom: 'auto',
                    marginRight: '-50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: '#1a1a2e',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '20px',
                    width: '90%',
                    maxWidth: '600px',
                    maxHeight: '80vh',
                    overflow: 'auto',
                },
            }}
            contentLabel="Transaction History"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    🕐
                    <LocalizedText name="USD Transactions" />
                </h2>
                <button
                    onClick={onRequestClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.6)',
                        cursor: 'pointer',
                        fontSize: '20px',
                    }}
                >
                    ✕
                </button>
            </div>

            {loading ? (
                <div style={{ color: 'white', textAlign: 'center', padding: '20px' }}>
                    <LocalizedText name="Loading transactions..." />
                </div>
            ) : transactions.filter(tx => tx.paymentMethod === 'WEBAI' || (!tx.paymentMethod && !tx.txHash)).length === 0 ? (
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', padding: '20px' }}>
                    <LocalizedText name="No transactions found." />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {transactions
                        .filter(tx => tx.paymentMethod === 'WEBAI' || (!tx.paymentMethod && !tx.txHash))
                        .map((tx, index) => {
                            const amount = getAmount(tx);
                            const displayName = getDisplayName(tx);
                            const status = tx.status || 'completed';

                            return (
                                <div
                                    key={index}
                                    style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                        borderRadius: '8px',
                                        padding: '12px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <div>
                                        <div style={{ color: 'white', fontWeight: 'bold', marginBottom: '4px' }}>
                                            {displayName}
                                        </div>
                                        <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
                                            {formatDate(tx.timestamp)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{
                                            color: '#ff4444', // Debit (user spent)
                                            fontWeight: 'bold',
                                            marginBottom: '4px'
                                        }}>
                                            -${amount.toFixed(4)}
                                        </div>
                                        {/* Show BaseScan link for USDC transactions */}
                                        {(tx as any).txHash ? (
                                            <a
                                                href={`https://${(tx as any).network?.includes('84532') ? 'sepolia.' : ''}basescan.org/tx/${(tx as any).txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: '#0096FF',
                                                    fontSize: '11px',
                                                    textDecoration: 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                🔗 View on BaseScan
                                            </a>
                                        ) : (
                                            <div style={{
                                                color: status === 'completed' || status === 'success' ? '#00ff88' : '#ffaa00',
                                                fontSize: '11px',
                                                textTransform: 'capitalize'
                                            }}>
                                                {(tx as any).paymentMethod === 'USDC' ? 'USDC' : status}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </Modal>
    );
};

export default HistoryModal;
