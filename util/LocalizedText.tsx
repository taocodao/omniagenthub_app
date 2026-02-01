import React, { useContext, useEffect, useState, useCallback } from 'react';
import { LocalizationContext } from './LocalizationContext';

interface LocalizedTextProps {
    name: string;
}

// Common translations dictionary to avoid API calls for static UI elements
const STATIC_UI_TRANSLATIONS: Record<string, Record<string, string>> = {
    'Knowledge Base': { 'chinese': '知识库', 'japanese': '知識ベース', 'korean': '지식 베이스', 'spanish': 'Base de Conocimiento' },
    'Online': { 'chinese': '在线', 'japanese': 'オンライン', 'korean': '온라인', 'spanish': 'En línea' },
    'Offline': { 'chinese': '离线', 'japanese': 'オフライン', 'korean': '오프라인', 'spanish': 'Desconectado' },
    '+ Create notebook': { 'chinese': '+ 创建笔记本', 'japanese': '+ ノートブックを作成', 'korean': '+ 노트북 만들기', 'spanish': '+ Crear cuaderno' },
    'Chat': { 'chinese': '聊天', 'japanese': 'チャット', 'korean': '채팅', 'spanish': 'Chat' },
    'Start typing...': { 'chinese': '开始输入...', 'japanese': '入力して...', 'korean': '입력 시작...', 'spanish': 'Escribe aquí...' },
    'Ask questions about your selected sources': { 'chinese': '对你选定的来源提出问题', 'japanese': '選択したソースについて質問する', 'korean': '선택한 소스에 대해 질문하기', 'spanish': 'Haz preguntas sobre tus fuentes seleccionadas' },
    'AI learns from your feedback': { 'chinese': '人工智能从您的反馈中学习', 'japanese': 'AIはあなたのフィードバックから学習します', 'korean': 'AI는 피드백에서 학습합니다', 'spanish': 'La IA aprende de tus comentarios' },
    'sources': { 'chinese': '资源', 'japanese': 'ソース', 'korean': '소스', 'spanish': 'fuentes' },
    'Loading...': { 'chinese': '加载中...', 'japanese': '読み込み中...', 'korean': '로딩 중...', 'spanish': 'Cargando...' },
    'No notebooks yet.': { 'chinese': '还没有笔记本。', 'japanese': 'ノートブックはまだありません。', 'korean': '노트북이 없습니다.', 'spanish': 'No hay cuadernos todavía.' },
    'Click "+ Create notebook" to start.': { 'chinese': '点击“+ 创建笔记本”开始。', 'japanese': '「+ ノートブックを作成」をクリックして開始します。', 'korean': '시작하려면 "+ 노트북 만들기"를 클릭하세요.', 'spanish': 'Haz clic en "+ Crear cuaderno" para comenzar.' },
    'cached': { 'chinese': '已缓存', 'japanese': 'キャッシュ済み', 'korean': '캐시됨', 'spanish': 'en caché' },
};

// getLocalizedString helper (simplified, no API access directly here as it lacks context)
export const getLocalizedString = async (name: string, language: string): Promise<string> => {
    if (language.toLowerCase() === 'english' || language.toLowerCase() === 'en') {
        return name;
    }

    // Check common translations first
    const dictionary = STATIC_UI_TRANSLATIONS[name];
    if (dictionary) {
        const langKey = language.toLowerCase();
        for (const key of Object.keys(dictionary)) {
            if (langKey.includes(key)) {
                return dictionary[key];
            }
        }
    }

    // Fallback: This helper function cannot access context-bound getLocalizedContent.
    // In a real usage, one should use the hook or pass the fetcher function.
    return name;
};

export const useLocalizedString = (name: string): string => {
    const { language, getLocalizedContent } = useContext(LocalizationContext);
    const [content, setContent] = useState<string>(name);

    useEffect(() => {
        let isMounted = true;

        const fetchContent = async () => {
            if (language.toLowerCase() === 'english' || language.toLowerCase() === 'en') {
                if (isMounted) setContent(name);
                return;
            }

            // Check common translations first (Client-side optimization)
            const dictionary = STATIC_UI_TRANSLATIONS[name];
            if (dictionary) {
                const langKey = language.toLowerCase();
                for (const key of Object.keys(dictionary)) {
                    if (langKey.includes(key)) {
                        if (isMounted) setContent(dictionary[key]);
                        return; // Found in dictionary, skip API call
                    }
                }
            }

            // Fallback to API if not in dictionary
            try {
                const localizedContent = await getLocalizedContent(name, language);
                if (isMounted) setContent(localizedContent || name);
            } catch (error) {
                console.error('Translation error:', error);
                // Fallback to original name if translation fails
                if (isMounted) setContent(name);
            }
        };

        fetchContent();

        return () => { isMounted = false; };
    }, [name, language, getLocalizedContent]);

    return content;
};

export const useLocalizedString1 = (name: string, shouldTranslate: boolean): string => {
    const { language, getLocalizedContent } = useContext(LocalizationContext);
    const [content, setContent] = useState<string>(name);

    useEffect(() => {
        const fetchContent = async () => {
            if (language.toLowerCase() === 'english' || language.toLowerCase() === 'en' || !shouldTranslate) {
                setContent(name);
            } else {
                const localizedContent = await getLocalizedContent(name, language);
                setContent(localizedContent || name);
            }
        };

        fetchContent();
    }, [name, language, getLocalizedContent]);

    return content;
};

export const LocalizedText: React.FC<LocalizedTextProps> = ({ name }) => {
    const content = useLocalizedString(name);
    return <>{content}</>;
};

export const LocalizedText1: React.FC<LocalizedTextProps> = ({ name }) => {
    const { language, getLocalizedContent } = useContext(LocalizationContext);
    const [localizedContent, setLocalizedContent] = React.useState(name);

    React.useEffect(() => {
        const fetchLocalizedContent = async () => {
            if (language.toLowerCase() === 'english' || language.toLowerCase() === 'en') {
                setLocalizedContent(name);
            } else {
                try {
                    const content = await getLocalizedContent(name, language);
                    setLocalizedContent(content || name);
                } catch (error) {
                    console.error('Error fetching localized content:', error);
                    setLocalizedContent(name);
                }
            }
        };

        fetchLocalizedContent();
    }, [name, language, getLocalizedContent]);

    return <>{localizedContent}</>;
};
