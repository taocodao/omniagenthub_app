// EntrepreneurGroupManager.tsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { toast } from 'react-toastify';
import { LocalizationContext } from '../util/LocalizationContext';
import { getLocalizedString } from '../util/LocalizedText';

interface EntrepreneurGroupManagerProps {
    onGroupChange?: (selectedDepartments: string[]) => void;
}

const EntrepreneurGroupManager: React.FC<EntrepreneurGroupManagerProps> = ({ onGroupChange }) => {
    const { language } = useContext(LocalizationContext);
    const [allDepartments, setAllDepartments] = useState<string[]>([]);
    const [entrepreneurGroupDepartments, setEntrepreneurGroupDepartments] = useState<string[]>([]);
    const [selectedAvailable, setSelectedAvailable] = useState<string>('');
    const [selectedEntrepreneur, setSelectedEntrepreneur] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // Get available departments (all departments except those in entrepreneur group)
    const getAvailableDepartments = useCallback(() => {
        return allDepartments.filter(dept => !entrepreneurGroupDepartments.includes(dept));
    }, [allDepartments, entrepreneurGroupDepartments]);

    // Fetch all departments
    const fetchAllDepartments = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/get-departments1', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch departments');
            }

            const departments = await response.json();
            setAllDepartments(Array.isArray(departments) ? departments : []);
        } catch (error) {
            console.error('Error fetching departments:', error);
            toast.error(await getLocalizedString('Failed to fetch departments', language));
        } finally {
            setLoading(false);
        }
    }, [language]);

    // Fetch entrepreneur group departments
    const fetchEntrepreneurGroupDepartments = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/get-entrepreneur-group-departments', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch entrepreneur group departments');
            }

            const data = await response.json();
            const departments = Array.isArray(data.departments) ? data.departments : [];
            setEntrepreneurGroupDepartments(departments);
            onGroupChange?.(departments);
        } catch (error) {
            console.error('Error fetching entrepreneur group departments:', error);
            toast.error(await getLocalizedString('Failed to fetch entrepreneur group departments', language));
        } finally {
            setLoading(false);
        }
    }, [language, onGroupChange]);

    // Add department to entrepreneur group
    const addDepartmentToGroup = useCallback(async (department: string) => {
        if (!department) return;

        try {
            setLoading(true);
            const response = await fetch('/api/add-entrepreneur-group-department', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department }),
            });

            if (!response.ok) {
                throw new Error('Failed to add department to entrepreneur group');
            }

            await fetchEntrepreneurGroupDepartments();
            setSelectedAvailable('');
            toast.success(await getLocalizedString(`Added ${department} to Entrepreneur Group`, language));
        } catch (error) {
            console.error('Error adding department:', error);
            toast.error(await getLocalizedString('Failed to add department to entrepreneur group', language));
        } finally {
            setLoading(false);
        }
    }, [language, fetchEntrepreneurGroupDepartments]);

    // Remove department from entrepreneur group
    const removeDepartmentFromGroup = useCallback(async (department: string) => {
        if (!department) return;

        try {
            setLoading(true);
            const response = await fetch('/api/remove-entrepreneur-group-department', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department }),
            });

            if (!response.ok) {
                throw new Error('Failed to remove department from entrepreneur group');
            }

            await fetchEntrepreneurGroupDepartments();
            setSelectedEntrepreneur('');
            toast.success(await getLocalizedString(`Removed ${department} from Entrepreneur Group`, language));
        } catch (error) {
            console.error('Error removing department:', error);
            toast.error(await getLocalizedString('Failed to remove department from entrepreneur group', language));
        } finally {
            setLoading(false);
        }
    }, [language, fetchEntrepreneurGroupDepartments]);

    // Refresh data
    const handleRefresh = useCallback(async () => {
        await Promise.all([fetchAllDepartments(), fetchEntrepreneurGroupDepartments()]);
        toast.success(await getLocalizedString('Data refreshed successfully', language));
    }, [fetchAllDepartments, fetchEntrepreneurGroupDepartments, language]);

    // Initialize data on component mount
    useEffect(() => {
        fetchAllDepartments();
        fetchEntrepreneurGroupDepartments();
    }, [fetchAllDepartments, fetchEntrepreneurGroupDepartments]);

    const availableDepartments = getAvailableDepartments();

    return (
        <div style={{ padding: '2rem', backgroundColor: '#f8f9fa', borderRadius: '8px', margin: '1rem 0' }}>
            <h2 style={{ marginBottom: '1.5rem', color: '#495057' }}>
                🏢 Entrepreneur Group Department Manager
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', color: 'black' }}>
                {/* Available Departments Dropdown */}
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'black' }}>
                        Available Departments ({availableDepartments.length})
                    </label>
                    <select
                        value={selectedAvailable}
                        onChange={(e) => setSelectedAvailable(e.target.value)}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            backgroundColor: 'white'
                        }}
                    >
                        <option value="">Select a department...</option>
                        {availableDepartments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        onClick={() => addDepartmentToGroup(selectedAvailable)}
                        disabled={!selectedAvailable || loading}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: selectedAvailable && !loading ? '#28a745' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedAvailable && !loading ? 'pointer' : 'not-allowed',
                            fontSize: '0.9rem',
                            fontWeight: 'bold'
                        }}
                    >
                        Add →
                    </button>
                    <button
                        onClick={() => removeDepartmentFromGroup(selectedEntrepreneur)}
                        disabled={!selectedEntrepreneur || loading}
                        style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: selectedEntrepreneur && !loading ? '#dc3545' : '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: selectedEntrepreneur && !loading ? 'pointer' : 'not-allowed',
                            fontSize: '0.9rem',
                            fontWeight: 'bold'
                        }}
                    >
                        ← Remove
                    </button>
                </div>

                {/* Entrepreneur Group Departments Dropdown */}
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                        Entrepreneur Group Departments ({entrepreneurGroupDepartments.length})
                    </label>
                    <select
                        value={selectedEntrepreneur}
                        onChange={(e) => setSelectedEntrepreneur(e.target.value)}
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem',
                            backgroundColor: 'white'
                        }}
                    >
                        <option value="">Select a department...</option>
                        {entrepreneurGroupDepartments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Refresh Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: loading ? '#6c757d' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold'
                    }}
                >
                    {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>
            </div>

            {/* Status Display */}
            {loading && (
                <div style={{ textAlign: 'center', marginTop: '1rem', color: '#6c757d' }}>
                    Loading...
                </div>
            )}
        </div>
    );
};

export default EntrepreneurGroupManager;
