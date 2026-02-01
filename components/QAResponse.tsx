// components/QAResponse.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { QuestionAnswer } from '../types';
import styles from "../styles/Home5.module.css";
import { LocalizedText, getLocalizedString } from "../util/LocalizedText";

interface QAResponseProps {
    qaResponse: string;
    isEditing: boolean;
    toggleEdit: () => void;
    editableQA: QuestionAnswer[];
    editableQAForEmbed: QuestionAnswer[];
    handleAnswerChange: (index: number, newAnswer: string) => void;
    handleAnswerSubmit: (saveToTaskChecks?: boolean[]) => void;
    numQuestions: number;
    isLoading: boolean;
    saveToTaskChecks: boolean[];
    setSaveToTaskChecks: React.Dispatch<React.SetStateAction<boolean[]>>;
}

const QAResponse: React.FC<QAResponseProps> = ({
    qaResponse,
    isEditing,
    toggleEdit,
    editableQA,
    handleAnswerChange,
    handleAnswerSubmit,
    numQuestions,
    isLoading,
    saveToTaskChecks,
    setSaveToTaskChecks
}) => {
    const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState<string>('');
    const [feedbackGiven, setFeedbackGiven] = useState<{ [key: number]: 'up' | 'down' | 'edited' | null }>({});

    const setTextAreaRef = useCallback((el: HTMLTextAreaElement | null, index: number) => {
        textareaRefs.current[index] = el;
    }, []);

    useEffect(() => {
        if (isEditing) {
            textareaRefs.current.forEach((textarea) => {
                if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${textarea.scrollHeight}px`;
                }
            });
        }
    }, [isEditing, editableQA]);

    useEffect(() => {
        if (editableQA.length > 0 && saveToTaskChecks.length !== editableQA.length) {
            const updatedSaveToTaskChecks = editableQA.map(() => true);
            setSaveToTaskChecks(updatedSaveToTaskChecks);
        }
    }, [editableQA, saveToTaskChecks.length, setSaveToTaskChecks]);

    const handleTextareaResize = (index: number) => {
        const textarea = textareaRefs.current[index];
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    const startEditing = (index: number, currentAnswer: string) => {
        setEditingIndex(index);
        setEditText(currentAnswer);
    };

    const cancelEditing = () => {
        setEditingIndex(null);
        setEditText('');
    };

    const saveEdit = (index: number) => {
        handleAnswerChange(index, editText);
        setFeedbackGiven(prev => ({ ...prev, [index]: 'edited' }));
        setEditingIndex(null);
        setEditText('');

        // Auto-check the save checkbox
        const updatedChecks = [...saveToTaskChecks];
        updatedChecks[index] = true;
        setSaveToTaskChecks(updatedChecks);
    };

    const handleFeedback = (index: number, isPositive: boolean) => {
        setFeedbackGiven(prev => ({ ...prev, [index]: isPositive ? 'up' : 'down' }));
        if (isPositive) {
            // Auto-check the save checkbox when thumbs up
            const updatedChecks = [...saveToTaskChecks];
            updatedChecks[index] = true;
            setSaveToTaskChecks(updatedChecks);
        }
    };

    const handleCheckboxChange = (index: number) => {
        const updatedChecks = [...saveToTaskChecks];
        updatedChecks[index] = !updatedChecks[index];
        setSaveToTaskChecks(updatedChecks);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {editableQA.map((qa, index) => (
                <div key={index}>
                    {/* Question bubble (User) */}
                    <div style={{
                        marginBottom: '8px',
                        padding: '14px 16px',
                        backgroundColor: '#2d2a5e',
                        borderRadius: '10px',
                        border: '1px solid #3d3a7e',
                    }}>

                        <div style={{
                            fontSize: '14px',
                            lineHeight: '1.6',
                            color: '#e2e8f0'
                        }}>
                            {qa.question}
                        </div>
                    </div>

                    {/* Answer bubble (Assistant) */}
                    <div style={{
                        padding: '14px 16px',
                        backgroundColor: '#1a1a2e',
                        borderRadius: '10px',
                        border: '1px solid #2a2a4e',
                    }}>
                        {feedbackGiven[index] && (
                            <div style={{ marginBottom: '8px', textAlign: 'right' }}>
                                <span style={{ fontSize: '11px', color: '#888' }}>
                                    {feedbackGiven[index] === 'up' ? '✅ Saved' :
                                        feedbackGiven[index] === 'edited' ? '✏️ Improved' :
                                            '📝 Noted'}
                                </span>
                            </div>
                        )}

                        {/* Answer content or edit mode */}
                        {editingIndex === index ? (
                            <div>
                                <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    style={{
                                        width: '100%',
                                        minHeight: '120px',
                                        padding: '12px',
                                        backgroundColor: '#0d0d1a',
                                        border: '2px solid #7c3aed',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '14px',
                                        resize: 'vertical',
                                        lineHeight: '1.6'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                    <button
                                        onClick={() => saveEdit(index)}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#7c3aed',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '500'
                                        }}
                                    >
                                        💾 <LocalizedText name="Save" />
                                    </button>
                                    <button
                                        onClick={cancelEditing}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#333',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <LocalizedText name="Cancel" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                fontSize: '14px',
                                lineHeight: '1.6',
                                color: '#e2e8f0',
                            }} className="markdown-content">
                                <ReactMarkdown>{qa.answer}</ReactMarkdown>
                            </div>
                        )}

                        {/* Feedback buttons */}
                        {editingIndex !== index && !feedbackGiven[index] && (
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                marginTop: '12px',
                                alignItems: 'center'
                            }}>
                                <button
                                    onClick={() => handleFeedback(index, true)}
                                    title="Good answer"
                                    style={{
                                        background: 'none',
                                        border: '1px solid #444',
                                        borderRadius: '6px',
                                        padding: '6px 12px',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    👍
                                </button>
                                <button
                                    onClick={() => handleFeedback(index, false)}
                                    title="Bad answer"
                                    style={{
                                        background: 'none',
                                        border: '1px solid #444',
                                        borderRadius: '6px',
                                        padding: '6px 12px',
                                        cursor: 'pointer',
                                        fontSize: '16px'
                                    }}
                                >
                                    👎
                                </button>
                                <button
                                    onClick={() => startEditing(index, qa.answer)}
                                    title="Edit answer"
                                    style={{
                                        background: 'none',
                                        border: '1px solid #444',
                                        borderRadius: '6px',
                                        padding: '6px 12px',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        marginLeft: 'auto'
                                    }}
                                >
                                    ✏️
                                </button>
                            </div>
                        )}

                        {/* Save checkbox */}
                        <div style={{
                            marginTop: '12px',
                            paddingTop: '10px',
                            borderTop: '1px solid #333',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <input
                                type="checkbox"
                                checked={saveToTaskChecks[index] || false}
                                onChange={() => handleCheckboxChange(index)}
                                style={{ accentColor: '#7c3aed' }}
                            />
                            <span style={{ fontSize: '12px', color: '#888' }}>
                                <LocalizedText name="Save this Q&A for future use with this task" />
                            </span>
                        </div>
                    </div>
                </div>
            ))}

            {/* Submit button */}
            {editableQA.length > 0 && (
                <button
                    onClick={() => handleAnswerSubmit(saveToTaskChecks)}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        marginTop: '8px'
                    }}
                >
                    <LocalizedText name="Submit Answers" />
                </button>
            )}
        </div>
    );
};

export default QAResponse;
