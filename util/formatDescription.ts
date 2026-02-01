// utils/formatDescription.ts

export interface FormattedDescription {
    introText: string;
    items: Array<{
        title: string;
        content: string;
    }>;
}

export const formatDescription = (description: string): FormattedDescription => {
    if (!description || typeof description !== 'string') {
        return { introText: '', items: [] };
    }

    // Step 1: Remove leading and trailing quotes (single or double)
    const cleanDescription = description.replace(/^["']+|["']+$/g, '').trim();

    // Step 2: Regular expression to match numbered items (e.g., "1. ", "2. ")
    const regex = /(\d+\.\s+[^:]+):\s+([^1-9].*)/g;

    // Step 3: Extract the introductory text before the first numbered item
    const introMatch = cleanDescription.match(/^(.*?)\d+\.\s+/);
    const introText = introMatch ? introMatch[1].trim() : '';

    // Step 4: Extract all numbered items
    const items: Array<{ title: string; content: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(cleanDescription)) !== null) {
        const title = match[1].replace(/\d+\.\s+/, '').trim(); // Remove the numbering
        const content = match[2].trim();
        items.push({ title, content });
    }

    return { introText, items };
};
