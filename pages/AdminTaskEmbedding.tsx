// AdminTaskEmbedding.tsx
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { toast } from 'react-toastify';
import { LocalizationContext } from '../util/LocalizationContext';
import { LocalizedText, getLocalizedString } from '../util/LocalizedText';

interface ProcessingStats {
    totalRoles: number;
    totalTasks: number;
    processedTasks: number;
    failedTasks: number;
    currentOperation: string;
    isRunning: boolean;
    startTime: Date | null;
    estimatedCompletion: Date | null;
    isProductionMode: boolean;
}

interface ProgressLog {
    id: number;
    timestamp: Date;
    type: 'error' | 'success' | 'info' | 'warning';
    message: string;
    details?: string;
}

const DEPARTMENT = "Vibe Marketing";
const DEV_MODE_TASK_LIMIT = 10;

const AdminTaskEmbedding: React.FC = () => {
    const { language } = useContext(LocalizationContext);

    const [stats, setStats] = useState<ProcessingStats>({
        totalRoles: 0,
        totalTasks: 0,
        processedTasks: 0,
        failedTasks: 0,
        currentOperation: '',
        isRunning: false,
        startTime: null,
        estimatedCompletion: null,
        isProductionMode: false
    });

    const [logs, setLogs] = useState<ProgressLog[]>([]);
    const [logId, setLogId] = useState<number>(0);
    const [isProductionMode, setIsProductionMode] = useState<boolean>(false);
    const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
    const [batchSize, setBatchSize] = useState<number>(5);
    const [delayBetweenRequests, setDelayBetweenRequests] = useState<number>(1000);

    // Error handling helper
    const getErrorMessage = (error: unknown): string => {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return String(error);
    };

    // Add log entry
    const addLog = useCallback((type: ProgressLog['type'], message: string, details?: string) => {
        setLogs(prev => [
            {
                id: logId,
                timestamp: new Date(),
                type,
                message,
                details
            },
            ...prev.slice(0, 499) // Keep only last 500 logs
        ]);
        setLogId(prev => prev + 1);
    }, [logId]);

    // Calculate estimated completion time
    const calculateEstimatedCompletion = useCallback((totalTasks: number, processed: number, startTime: Date): Date | null => {
        if (processed === 0) return null;

        const elapsed = Date.now() - startTime.getTime();
        const avgTimePerTask = elapsed / processed;
        const remaining = totalTasks - processed;
        const estimatedRemainingTime = remaining * avgTimePerTask;

        return new Date(Date.now() + estimatedRemainingTime);
    }, []);

    // Main processing function
    const processTaskEmbeddings = useCallback(async () => {
        if (stats.isRunning) return;

        const startTime = new Date();
        setStats(prev => ({
            ...prev,
            isRunning: true,
            processedTasks: 0,
            failedTasks: 0,
            startTime,
            currentOperation: 'Initializing...',
            isProductionMode
        }));

        // Log mode status
        if (isProductionMode) {
            addLog('success', '🚀 Starting PRODUCTION mode - processing ALL roles and tasks...');
        } else {
            addLog('warning', `🧪 Starting DEVELOPMENT mode - processing FIRST role only with max ${DEV_MODE_TASK_LIMIT} tasks...`);
        }

        addLog('info', `Configuration: Production: ${isProductionMode}, Batch size: ${batchSize}, Delay: ${delayBetweenRequests}ms`);

        try {
            // Call the API endpoint to process embeddings
            const response = await fetch('/api/process-task-embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department: DEPARTMENT,
                    isProductionMode,
                    batchSize,
                    delayBetweenRequests,
                    devModeTaskLimit: DEV_MODE_TASK_LIMIT
                }),
            });

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }

            // Handle streaming response for real-time updates
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));

                                if (data.type === 'progress') {
                                    setStats(prev => ({
                                        ...prev,
                                        totalRoles: data.totalRoles || prev.totalRoles,
                                        totalTasks: data.totalTasks || prev.totalTasks,
                                        processedTasks: data.processedTasks || prev.processedTasks,
                                        failedTasks: data.failedTasks || prev.failedTasks,
                                        currentOperation: data.currentOperation || prev.currentOperation,
                                        estimatedCompletion: data.processedTasks > 0 ?
                                            calculateEstimatedCompletion(data.totalTasks, data.processedTasks, startTime) : null
                                    }));
                                } else if (data.type === 'log') {
                                    addLog(data.logType, data.message, data.details);
                                } else if (data.type === 'complete') {
                                    addLog('success', '🎉 Task embedding process completed!');
                                    break;
                                } else if (data.type === 'error') {
                                    addLog('error', `❌ Process failed: ${data.message}`);
                                    break;
                                }
                            } catch (parseError) {
                                console.error('Error parsing SSE data:', parseError);
                            }
                        }
                    }
                }
            }

            const endTime = new Date();
            const totalTime = endTime.getTime() - startTime.getTime();
            const totalTimeMinutes = Math.round(totalTime / 60000);

            addLog('info', `⏱️ Total processing time: ${totalTimeMinutes} minutes`);
            toast.success(await getLocalizedString(`Task embedding completed! Mode: ${isProductionMode ? 'PRODUCTION' : 'DEVELOPMENT'}. Time: ${totalTimeMinutes} minutes.`, language));

        } catch (error) {
            addLog('error', '❌ Fatal error during task embedding process', getErrorMessage(error));
            toast.error(await getLocalizedString('Task embedding process failed with fatal error', language));
        } finally {
            setStats(prev => ({
                ...prev,
                isRunning: false,
                currentOperation: 'Completed',
                estimatedCompletion: null
            }));
        }
    }, [stats.isRunning, isProductionMode, batchSize, delayBetweenRequests, calculateEstimatedCompletion, language, addLog]);

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <h1><LocalizedText name="🔧 Admin: Task Embedding Processor" /></h1>
            <p><LocalizedText name={`Process and insert task descriptions into embeddings for ${DEPARTMENT} department`} /></p>

            {/* Configuration Panel */}
            <div style={{
                backgroundColor: '#f8f9fa',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                border: '1px solid #dee2e6'
            }}>
                <h3><LocalizedText name="⚙️ Configuration" /></h3>

                {/* Production Mode Checkbox */}
                <div style={{
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    backgroundColor: isProductionMode ? '#d4edda' : '#fff3cd',
                    border: `2px solid ${isProductionMode ? '#c3e6cb' : '#ffeaa7'}`,
                    borderRadius: '8px'
                }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={isProductionMode}
                            onChange={(e) => setIsProductionMode(e.target.checked)}
                            disabled={stats.isRunning}
                            style={{
                                width: "20px",
                                height: "20px",
                                cursor: "pointer"
                            }}
                        />
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '16px', color: isProductionMode ? '#155724' : '#856404' }}>
                                {isProductionMode ? '🚀 Production Mode' : '🧪 Development Mode'}
                            </div>
                            <div style={{ fontSize: '14px', color: isProductionMode ? '#155724' : '#856404', marginTop: '0.25rem' }}>
                                {isProductionMode
                                    ? <LocalizedText name="Process ALL roles and ALL tasks (full production run)" />
                                    : <LocalizedText name={`Process FIRST role only with max ${DEV_MODE_TASK_LIMIT} tasks (development testing)`} />
                                }
                            </div>
                        </div>
                    </label>
                </div>

                {/* Advanced Options */}
                <div style={{ marginBottom: '1rem' }}>
                    <button
                        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                        style={{
                            backgroundColor: 'transparent',
                            border: '1px solid #6c757d',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginBottom: '1rem'
                        }}
                    >
                        <LocalizedText name={showAdvancedOptions ? "Hide Advanced Options" : "Show Advanced Options"} />
                    </button>

                    {showAdvancedOptions && (
                        <div style={{
                            backgroundColor: 'white',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: '1rem'
                        }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                    <LocalizedText name="Batch Size (concurrent requests):" />
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={batchSize}
                                    onChange={(e) => setBatchSize(parseInt(e.target.value))}
                                    disabled={stats.isRunning}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px'
                                    }}
                                />
                                <small style={{ color: '#666', fontSize: '12px' }}>
                                    <LocalizedText name="Higher = faster but more API load" />
                                </small>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                                    <LocalizedText name="Delay Between Batches (ms):" />
                                </label>
                                <input
                                    type="number"
                                    min="100"
                                    max="5000"
                                    step="100"
                                    value={delayBetweenRequests}
                                    onChange={(e) => setDelayBetweenRequests(parseInt(e.target.value))}
                                    disabled={stats.isRunning}
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid #ddd',
                                        borderRadius: '4px'
                                    }}
                                />
                                <small style={{ color: '#666', fontSize: '12px' }}>
                                    <LocalizedText name="Higher = slower but safer for APIs" />
                                </small>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={processTaskEmbeddings}
                        disabled={stats.isRunning}
                        style={{
                            padding: '1rem 2rem',
                            backgroundColor: stats.isRunning ? '#6c757d' : (isProductionMode ? '#dc3545' : '#28a745'),
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: stats.isRunning ? 'not-allowed' : 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            flex: '1',
                            minWidth: '200px'
                        }}
                    >
                        {stats.isRunning ? (
                            <LocalizedText name="🔄 Processing..." />
                        ) : (
                            isProductionMode ? (
                                <LocalizedText name="🚀 Start PRODUCTION Embedding" />
                            ) : (
                                <LocalizedText name="🧪 Start DEVELOPMENT Embedding" />
                            )
                        )}
                    </button>

                    <button
                        onClick={() => setLogs([])}
                        disabled={stats.isRunning}
                        style={{
                            padding: '1rem 1.5rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: stats.isRunning ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <LocalizedText name="🗑️ Clear Logs" />
                    </button>
                </div>
            </div>

            {/* Progress Panel */}
            <div style={{
                backgroundColor: '#e7f3ff',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                border: '1px solid #b3d9ff'
            }}>
                <h3><LocalizedText name="📊 Progress Dashboard" /></h3>

                {/* Production Mode Status */}
                {stats.isRunning && (
                    <div style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        backgroundColor: stats.isProductionMode ? '#d4edda' : '#fff3cd',
                        border: `1px solid ${stats.isProductionMode ? '#c3e6cb' : '#ffeaa7'}`,
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        color: stats.isProductionMode ? '#155724' : '#856404'
                    }}>
                        {stats.isProductionMode
                            ? <LocalizedText name="🚀 PRODUCTION MODE: Processing ALL tasks" />
                            : <LocalizedText name={`🧪 DEVELOPMENT MODE: Processing FIRST role only (max ${DEV_MODE_TASK_LIMIT} tasks)`} />
                        }
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                            {stats.processedTasks}
                        </div>
                        <div><LocalizedText name="Processed" /></div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc3545' }}>
                            {stats.failedTasks}
                        </div>
                        <div><LocalizedText name="Failed" /></div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>
                            {stats.totalTasks}
                        </div>
                        <div><LocalizedText name="Total Tasks" /></div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'white', borderRadius: '8px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6c757d' }}>
                            {stats.totalTasks > 0 ? Math.round((stats.processedTasks + stats.failedTasks) / stats.totalTasks * 100) : 0}%
                        </div>
                        <div><LocalizedText name="Complete" /></div>
                    </div>
                </div>

                {stats.isRunning && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <strong><LocalizedText name="Current Operation:" /></strong> {stats.currentOperation}
                        </div>
                        {stats.estimatedCompletion && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong><LocalizedText name="Estimated Completion:" /></strong> {stats.estimatedCompletion.toLocaleTimeString()}
                            </div>
                        )}
                        {stats.startTime && (
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong><LocalizedText name="Running Time:" /></strong> {Math.round((Date.now() - stats.startTime.getTime()) / 60000)} minutes
                            </div>
                        )}
                    </div>
                )}

                {/* Progress Bar */}
                {stats.totalTasks > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <LocalizedText name="Overall Progress:" /> {stats.processedTasks + stats.failedTasks}/{stats.totalTasks}
                        </div>
                        <div style={{
                            width: '100%',
                            backgroundColor: '#f0f0f0',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            height: '20px'
                        }}>
                            <div style={{
                                width: `${((stats.processedTasks + stats.failedTasks) / stats.totalTasks) * 100}%`,
                                backgroundColor: stats.failedTasks > 0 ? '#ffc107' : '#28a745',
                                height: '100%',
                                transition: 'width 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}>
                                {stats.totalTasks > 0 ? Math.round(((stats.processedTasks + stats.failedTasks) / stats.totalTasks) * 100) : 0}%
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Logs Panel */}
            <div style={{
                backgroundColor: '#f8f9fa',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid #dee2e6'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3><LocalizedText name="📝 Activity Log" /></h3>
                    <div style={{ fontSize: '14px', color: '#6c757d' }}>
                        {logs.length} entries (last 500 shown)
                    </div>
                </div>

                <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    backgroundColor: 'white',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid #dee2e6',
                    fontFamily: 'Monaco, Consolas, "Lucida Console", monospace',
                    fontSize: '13px'
                }}>
                    {logs.length === 0 ? (
                        <div style={{ color: '#6c757d', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                            <LocalizedText name="No activity logs yet. Start the embedding process to see real-time progress." />
                        </div>
                    ) : (
                        logs.map(log => (
                            <div
                                key={log.id}
                                style={{
                                    marginBottom: '0.75rem',
                                    padding: '0.5rem',
                                    borderLeft: `4px solid ${log.type === 'error' ? '#dc3545' :
                                        log.type === 'success' ? '#28a745' :
                                            log.type === 'warning' ? '#ffc107' :
                                                log.type === 'info' ? '#17a2b8' : '#6c757d'
                                        }`,
                                    backgroundColor: log.type === 'error' ? '#f8f9fa' : 'transparent',
                                    borderRadius: '0 4px 4px 0'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: log.details ? '0.25rem' : '0'
                                }}>
                                    <span style={{
                                        color: log.type === 'error' ? '#dc3545' : '#333',
                                        fontWeight: log.type === 'error' ? 'bold' : 'normal',
                                        flex: 1
                                    }}>
                                        {log.message}
                                    </span>
                                    <span style={{
                                        fontSize: '11px',
                                        color: '#6c757d',
                                        marginLeft: '1rem',
                                        flexShrink: 0
                                    }}>
                                        {log.timestamp.toLocaleTimeString()}
                                    </span>
                                </div>
                                {log.details && (
                                    <div style={{
                                        fontSize: '11px',
                                        color: '#6c757d',
                                        wordBreak: 'break-word',
                                        fontStyle: 'italic',
                                        paddingLeft: '0.5rem',
                                        borderLeft: '2px solid #e9ecef',
                                        marginLeft: '0.5rem'
                                    }}>
                                        {log.details}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminTaskEmbedding;
