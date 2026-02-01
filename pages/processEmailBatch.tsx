import { useState, useEffect } from 'react';

interface EmailStat {
    recipient: string;
    sendCount: number;
    timestamps: string[];
}

interface SenderListResponse {
    senderKeys: string[];
}

interface BatchResponse {
    message: string;
    totalSent?: number;
    failedCompanies?: string[];
}

export default function ProcessEmailBatch() {
    const [senders, setSenders] = useState<string[]>([]);
    const [selectedSender, setSelectedSender] = useState<string>('');
    const [resultMessage, setResultMessage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [isProd, setIsProd] = useState<boolean>(false);

    useEffect(() => {
        const fetchSenders = async () => {
            try {
                const res = await fetch('/api/listSenders');
                if (!res.ok) throw new Error('Error fetching senders');
                const data: SenderListResponse = await res.json();
                setSenders(data.senderKeys || []);
            } catch (err) {
                console.error(err);
            }
        };
        fetchSenders();
    }, []);

    const runBatch = async () => {
        if (!selectedSender) {
            alert('Please select a sender.');
            return;
        }

        setLoading(true);
        setResultMessage('Batch processing started...');

        try {
            const res = await fetch('/api/processEmailBatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderName: selectedSender,
                    isProd
                }),
            });

            if (!res.ok) throw new Error('Batch initialization failed');

            const data: BatchResponse = await res.json();
            setResultMessage(data.message);

        } catch (err: any) {
            console.error(err);
            setResultMessage(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h1>Process Email Batch</h1>

            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="sender-select">Select Sender: </label>
                <select
                    id="sender-select"
                    value={selectedSender}
                    onChange={(e) => setSelectedSender(e.target.value)}
                    style={{
                        padding: '8px',
                        minWidth: '200px',
                        borderRadius: '4px',
                        border: '1px solid #ccc'
                    }}
                >
                    <option value="">--Select Sender--</option>
                    {senders.map((sender, idx) => (
                        <option key={idx} value={sender}>{sender}</option>
                    ))}
                </select>
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label>
                    <input
                        type="checkbox"
                        checked={isProd}
                        onChange={(e) => setIsProd(e.target.checked)}
                    />
                    Production Mode
                </label>
            </div>

            <button
                onClick={runBatch}
                disabled={loading || !selectedSender}
                style={{
                    padding: '10px 20px',
                    backgroundColor: loading ? '#6c757d' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                {loading ? 'Processing...' : 'Start Batch Process'}
            </button>

            <div style={{ marginTop: '20px' }}>
                <h2>Batch Status:</h2>
                <pre style={{
                    whiteSpace: 'pre-wrap',
                    padding: '15px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    border: '1px solid #dee2e6'
                }}>
                    {resultMessage || 'No status updates yet'}
                </pre>
            </div>
        </div>
    );
}
