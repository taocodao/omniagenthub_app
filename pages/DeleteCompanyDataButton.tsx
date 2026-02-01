import { useState } from 'react';

export default function DeleteCompanyDataButton() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleDelete = async () => {
        if (!confirm('WARNING: This will delete ALL company data. Continue?')) return;

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await fetch('/api/deleteCompanyData', {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Deletion failed');
            }

            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="delete-container">
            <button
                onClick={handleDelete}
                disabled={loading}
                className="delete-button"
            >
                {loading ? 'Deleting...' : 'Delete All Company Data'}
            </button>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">All company data deleted successfully</div>}
        </div>
    );
}
