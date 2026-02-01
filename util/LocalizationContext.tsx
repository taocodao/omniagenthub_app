import React, { createContext, useState, useCallback, useEffect } from 'react';


let contentCache: Record<string, Record<string, string>> = {};
let currentLanguage = 'english';

interface LocalizationContextType {
    language: string;
    setLanguage: (lang: string) => void;
    getLocalizedContent: (name: string, lang: string) => Promise<string>;
}

export const LocalizationContext = createContext<LocalizationContextType>({
    language: 'english',
    setLanguage: () => { },
    getLocalizedContent: async () => '',
});

interface LocalizationProviderProps {
    children: React.ReactNode;
}

export const getLocalizedContent = async (name: string, lang: string = currentLanguage): Promise<string> => {
    if (lang.toLowerCase() === 'english' || lang.toLowerCase() === 'en') {
        return name;
    }

    if (contentCache[name]?.[lang]) {
        return contentCache[name][lang];
    }

    try {
        const response = await fetch('/api/get_content_by_language', {
            //const response = await fetch('/util/get_content_by_language', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, language: lang }),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch localized content');
        }

        const data = await response.json();
        const content = data.content || name;

        contentCache = {
            ...contentCache,
            [name]: { ...contentCache[name], [lang]: content },
        };

        return content;
    } catch (error) {
        console.error('Error fetching localized content:', error);
        return name;
    }
};

export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({ children }) => {
    // Initialize language from localStorage or default to 'english'
    const [language, setLanguageState] = useState('english');
    const [contentCache, setContentCache] = useState<Record<string, Record<string, string>>>({});

    // Load language from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedLanguage = localStorage.getItem('app_language');
            if (savedLanguage) {
                setLanguageState(savedLanguage);
            }
        }
    }, []);

    // Wrapper that saves to localStorage when language changes
    const setLanguage = (lang: string) => {
        setLanguageState(lang);
        if (typeof window !== 'undefined') {
            localStorage.setItem('app_language', lang);
        }
    };

    const getLocalizedContent = useCallback(async (name: string, lang: string): Promise<string> => {
        if (lang.toLowerCase() === 'english' || lang.toLowerCase() === 'en') {
            return name;
        }

        if (contentCache[name]?.[lang]) {
            return contentCache[name][lang];
        }

        try {
            const response = await fetch('/api/get_content_by_language', {
                //const response = await fetch('/util/get_content_by_language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, language: lang }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch localized content');
            }

            const data = await response.json();
            const content = data.content || name;

            setContentCache(prevCache => ({
                ...prevCache,
                [name]: { ...prevCache[name], [lang]: content },
            }));

            return content;
        } catch (error) {
            console.error('Error fetching localized content:', error);
            return name;
        }
    }, [contentCache]);

    const contextValue: LocalizationContextType = {
        language,
        setLanguage,
        getLocalizedContent,
    };

    return (
        <LocalizationContext.Provider value={contextValue}>
            {children}
        </LocalizationContext.Provider>
    );
};
