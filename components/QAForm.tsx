// components/QAForm.tsx
import React from 'react';

interface QAFormProps {
    questions: string;
    setQuestions: (questions: string) => void;
    handleQuestionSubmit: () => void;
    isLoading: boolean;
}

const QAForm: React.FC<QAFormProps> = ({ questions, setQuestions, handleQuestionSubmit, isLoading }) => {
    return (
        <form onSubmit={handleQuestionSubmit} className="mb-4">
            <label htmlFor="questions" className="block mb-2">Enter questions (one per line):</label>
            <div className="w-full overflow-x-auto">
                <textarea
                    id="questions"
                    value={questions}
                    onChange={(e) => setQuestions(e.target.value)}
                    className="w-[150%] p-2 border rounded resize-both overflow-auto"
                    style={{ minHeight: '200px', minWidth: '100%', whiteSpace: 'pre-wrap' }}
                    rows={10}
                />
            </div>
            <button
                type="submit"
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
                disabled={isLoading}
            >
                {isLoading ? 'Submitting...' : 'Submit Questions'}
            </button>
        </form>
    );
};

export default QAForm;
