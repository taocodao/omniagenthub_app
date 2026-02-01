// types.ts
export interface Question {
    question: string;
}

export interface QuestionAnswer {
    question: string;
    answer: string;
    saveToTaskChecked?: boolean; // Add this line
}

export interface UserQuestions {
    userId: string;
    questions: Question[];
    role?: string;
    task?: string;
}

export interface UserQA {
    userId: string;
    qa: QuestionAnswer[];
}

// Add or update these interfaces in types.ts
export interface QuestionWithFlag {
    question: string;
    saveToTaskChecked?: boolean;
}

export interface UserQuestionsWithFlags extends UserQuestions {
    questions: QuestionWithFlag[];
    useSavedAnswers?: boolean;
}
