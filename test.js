const extractQuestions = (questionsText) => {
    console.log("Original Text:", questionsText);

    const questionsArray = questionsText.split(/\d+\.\s/);
    console.log("Split Text:", questionsArray);

    const questions = questionsArray.slice(1).map(q => q.trim());
    console.log("Trimmed Questions:", questions);

    const filteredQuestions = questions.filter(q => q.length > 0);
    console.log("Filtered Questions:", filteredQuestions);

    // Ensure only the first 5 questions are returned, and remove any trailing non-question text
    const cleanedQuestions = filteredQuestions.slice(0, 5).map(q => q.replace(/(\n.*)$/, '').trim());
    console.log("Cleaned Questions:", cleanedQuestions);

    return cleanedQuestions;
};

// Test script for verification
const inputText = `👋 I'm your Marketing Analysis Specialist AI. Let's design the ideal Pricing Analysis Document collaboratively. To provide the highest quality work, I need to ask you a few questions:

1. Could you provide details about the product or service for which you need the pricing analysis?
2. Who are your main competitors in the market, and what pricing strategies do they currently employ?
3. What are your primary business objectives and value proposition that should align with the pricing strategy?
4. Have you conducted any pricing research or analysis before, and if so, what were the key findings?
5. What specific market trends or changes do you believe are crucial to consider for this pricing analysis?

Please provide your insights on these questions so we can tailor the Pricing Analysis Document to meet your needs effectively.`;

const extractedQuestions = extractQuestions(inputText);
console.log("Extracted Questions:", extractedQuestions);
