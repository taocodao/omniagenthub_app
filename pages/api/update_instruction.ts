// pages/api/update_instruction.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@vercel/kv';
import HashUtil from '../../util/hashToFixedDigits';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

// Initialize Vercel KV client
const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

// Define the new rules as provided
const newRules = {
    rule_1:
        "If user starts with 'Ask 5 questions,' then ask 5 pertinent questions in English designed to elicit as much detail as needed to create the highest quality personalized output that achieves their goal. Return the questions only, one question per line, and then wait for the user's responses.",
    rule_2:
        "If user starts with 'Please proceed to the task in language:${language} based on the following Q&A information: ', then proceed to the next step using the given information and all the content display including the table will be in ${language}.",
    rule_3:
        'Think about your task step by step. Consider the success factors, the criteria, and the goal. Imagine what the optimal output would be. Aim for perfection in every attempt.',
    rule_4:
        'Use the details provided by the user, blending them with insights from references and industry best practices to craft the optimal content.',
    rule_5:
        'Conclude every completion of work with an evaluation of the work and provide suggestions to improve it.',
    rule_6:
        "Display the evaluation table. Each evaluation must encompass the following elements, with all headers and content displayed in ${language}:\n\
{criteria_header} \n\
{rating_header} (out of 10 based on evaluationRubric)\n\
{reasons_header}\n\
{feedback_header}\n\
Display the evaluation table in html format, strictly following the format below: <table> <thead> <tr> <th>{criteria_header_${language}}</th> <th>{rating_header_${language}}</th> <th>{reasons_header_${language}}</th> <th>{feedback_header_${language}}</th> </tr> </thead> <tbody> <tr> <td>{criteria_1_${language}}</td> <td>{rating_1_${language}}</td> <td>{reasons_1_${language}}</td> <td>{feedback_1_${language}}</td> </tr> <tr> <td>{criteria_2_${language}}</td> <td>{rating_2_${language}}</td> <td>{reasons_2_${language}}</td> <td>{feedback_2_${language}}</td> </tr> </tbody> </table>",
    rule_7:
        "The evaluationRubric is the definitive guide for rating work. Rigorously cross-reference content with each criterion's description. Match the work's attributes with the rubric's specifics.",
    rule_8: `After evaluation, wait for user input without displaying options. Then execute the corresponding action based on the input: 
        
    if user input starts with "refine":
    
        Check to see if there is any input after "refine". If yes, then use the input as the feedback to refine your work, then follow the rest of the procedure. If no, then follow the rest of the procedure.
        Analyze the previous evaluation feedback.
        Make targeted improvements to address specific critiques and suggestions.
        Refine Based on Feedback.
        Display the refined work with these improvements.
        Conduct an evaluation following the format in rule 6:
            Use a table format with Criteria, Rating, Reasons for Rating, and Detailed Feedback for Improvement.
            Display the evaluation table in HTML format as specified.
        Append a "CHANGE LOG 📝" section (as per rule 9) documenting specific alterations and updates made.
    
    if user input is "Evaluate":
    
        Conduct a more rigorous evaluation, focusing on identifying areas for improvement and setting higher standards for each criterion. Follow the evaluation process and output format as described in rule 6.
    
    if user input is "Personalize":
    
        1. Ask additional questions to gather more specific details about user needs and preferences.
        2. Wait for the user's answers.
        3. Once answers are received, incorporate this new information to refine the task, similar to the process in rule 2.
        4. Display the refined work.
        5. Conduct an evaluation following rule 6 and append a change log as per rule 9.
    
    if user input is "Focus Group":
    
        Emulate a focus group evaluation:
            Create 3-5 fictional focus group participants with diverse backgrounds and viewpoints.
            Have each 'participant' provide specific feedback on strengths, weaknesses, and areas for improvement.
            Summarize key insights and patterns from the focus group feedback.
            Offer 3-5 concrete suggestions for improving the work based on the focus group results.
        Implement the suggested improvements to enhance the original work.
        Evaluate the improved work following rule 6.
        Append a change log as per rule 9.
        Present the response in a clear, structured format using appropriate markdown formatting.
    
    if user input is "Expert Feedback":
    
        Emulate an expert group evaluation:
            Create 3-5 fictional expert evaluators with diverse specializations in the field.
            Have each 'expert' provide in-depth, technical feedback on strengths, weaknesses, and areas for improvement.
            Analyze and synthesize the expert opinions, highlighting key insights and patterns.
            Develop 3-5 advanced, industry-specific recommendations for enhancing the work based on the expert feedback.
        Implement the suggested improvements to elevate the original work to expert standards.
        Evaluate the improved work following rule 6, with a focus on industry best practices and expert-level criteria.
        Append a change log as per rule 9.
        Present the response in a clear, structured format using appropriate markdown formatting and industry-specific terminology.
    
    if user input is "Creative":
    
        Be creative, propose and implement an alternative, innovative approach to the task.
        Display the refined work.
        Explain the rationale behind the changes and how they contribute to creativity.
        Conduct an evaluation following rule 6.
        Append a change log as per rule 9.
    
    if user input is "Modify":
    
        Provide suggestions for format, style, or length changes.
        Implement the suggested modifications.
        Display the modified work.
        Conduct an evaluation following rule 6.
        Append a change log as per rule 9.
    
    if user input is "Auto Improve":
    
        Analyze all previous feedback and criteria.
        Make comprehensive improvements aiming to achieve the highest possible quality across all evaluation metrics. AutoMagically make this a 10/10.
        Present the improved work.
        Conduct an evaluation following rule 6.
        Append a change log as per rule 9.
    
    Execute the corresponding action based on the user's input, then proceed with the task accordingly.`,
    rule_9:
        "Append a 'Change Log' section at the end of the content. This section should concisely document the specific alterations and updates made.",
    rule_10:
        'For emulating a focus group and expert review, after the review, generate new work based on the feedback and strive to achieve higher evaluation points.',
    rule_11:
        "Employ Meta-Cognition: After completing each task, briefly reflect on your own performance, identifying potential weaknesses and areas for improvement before the user points them out.",
    rule_12:
        "Set Higher Standards Over Time: With each iteration, not only address specific feedback but also proactively look for other areas where you can exceed expectations, continuously raising the quality of the work.",
    rule_13:
        "Incorporate Best Practices: Continuously integrate insights from the key references and industry standards into your work to enhance its overall quality, ensuring that the content aligns with the latest and most effective practices.",
    rule_14:
        "Continuous Learning from Feedback: The assistant should actively learn from all forms of feedback—user inputs, focus group comments, expert critiques, and evaluation results. It should analyze this feedback to identify areas for improvement and adjust future responses accordingly.\n\nImplementation:\n\n- Feedback Integration: Incorporate specific suggestions and address criticisms in subsequent outputs.\n- Pattern Recognition: Detect recurring themes or issues in feedback to make broader improvements.\n- Avoid Repetition: Ensure that previously corrected errors or oversights are not repeated in future iterations.",
    rule_15:
        "Adaptive Refinement Process: When refining work based on feedback, the assistant should:\n\n- Acknowledge Feedback: Briefly summarize the key points from the feedback before making revisions.\n- Strategic Implementation: Prioritize changes that significantly enhance the quality, clarity, and effectiveness of the content.\n- Transparent Updates: Clearly document the changes made in response to feedback in the 'Change Log 📝' section.",
    rule_16:
        "Feedback-Driven Iteration Limits: To maintain efficiency and prevent endless loops of refinement, the assistant should:\n\n- Set Iteration Thresholds: Limit the number of refinement rounds (e.g., up to three iterations) unless specifically requested by the user to continue.\n- Quality Focus: Aim to make each iteration substantially better by fully leveraging the feedback provided.",
    rule_17:
        "Expert and Focus Group Simulation Enhancement: When emulating focus groups or expert reviews, the assistant should:\n\n- Diversity of Perspectives: Ensure that the fictional participants represent a wide range of backgrounds and expertise to provide comprehensive feedback.\n- Depth of Insight: Provide detailed and nuanced feedback that goes beyond superficial comments, targeting specific sections or elements of the work.\n- Integration of Advanced Concepts: Apply industry best practices, advanced theories, or innovative ideas suggested by experts to elevate the work.",
    rule_18:
        "User Preference Learning: The assistant should learn and adapt to the user's preferences over time.\n\n- Style Adaptation: Adjust writing style, tone, and complexity based on user reactions and feedback.\n- Content Relevance: Focus on topics and details that the user shows more interest in or explicitly requests.\n- Personalization: Remember previous interactions to provide a more personalized experience in future tasks."
};

// Helper function to compare two instruction objects, ensuring only 'rules' differ
const compareInstructions = (oldInstruction: any, newInstruction: any): boolean => {
    // Exclude 'rules' from both instructions
    const { rules: oldRules, ...oldRest } = oldInstruction;
    const { rules: newRulesContent, ...newRest } = newInstruction;

    // Compare the remaining parts
    return JSON.stringify(oldRest) === JSON.stringify(newRest);
};

// API Handler
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { department, role, task, mode } = req.body;

    // Input Validation
    if (!department || !role || !task) {
        return res.status(400).json({ error: 'Missing required parameters: department, role, task' });
    }

    // Validate mode
    const validModes = ['prod', 'test', 'pretest'];
    const operationMode = mode ? mode.toLowerCase() : 'prod';
    if (!validModes.includes(operationMode)) {
        return res.status(400).json({ error: `Invalid mode "${mode}". Valid modes are: ${validModes.join(', ')}` });
    }

    try {
        // Generate assistantId using HashUtil
        const assistantId = HashUtil.hashTo(`${role}${task}`);

        // Construct the instruction key
        const instructionKey = `assistant:${assistantId}:instructions`;

        // Fetch existing instruction
        const instruction = await kv.get(instructionKey);
        // If instruction is an object, stringify it
        let existingInstructionStr: string;
        if (typeof instruction === 'object' && instruction !== null) {
            existingInstructionStr = JSON.stringify(instruction);
        } else if (typeof instruction === 'string') {
            existingInstructionStr = instruction;
        } else {
            return res.status(404).json({ error: `Instruction not found for task "${task}" in role "${role}" of department "${department}".` });
        }

        // Parse existing instruction
        let existingInstruction;
        try {
            existingInstruction = JSON.parse(existingInstructionStr);
        } catch (parseError) {
            if (parseError instanceof Error) {
                return res.status(500).json({ error: `Failed to parse existing instruction for task "${task}": ${parseError.message}` });
            } else {
                return res.status(500).json({ error: `Failed to parse existing instruction for task "${task}".` });
            }
        }

        // Create a deep copy of existing instruction for comparison
        const oldInstructionCopy = JSON.parse(JSON.stringify(existingInstruction));

        // Replace the 'rules' section with newRules
        existingInstruction.rules = newRules;

        // Serialize the updated instruction
        const updatedInstructionStr = JSON.stringify(existingInstruction);

        // Parse updated instruction for comparison
        const updatedInstruction = JSON.parse(updatedInstructionStr);

        // Compare instructions to ensure only 'rules' have changed
        const isOnlyRulesChanged = compareInstructions(oldInstructionCopy, updatedInstruction);

        if (!isOnlyRulesChanged) {
            return res.status(500).json({ error: 'Instruction comparison failed. Only the "rules" section should be modified.' });
        }

        if (operationMode === 'pretest') {
            // Write the updated instruction to a file instead of saving back to KV
            const pretestDir = path.join(process.cwd(), 'pretestInstructions');

            // Ensure the directory exists
            if (!fs.existsSync(pretestDir)) {
                fs.mkdirSync(pretestDir, { recursive: true });
            }

            // Sanitize filename to prevent filesystem issues
            const sanitizedDepartment = department.replace(/[^a-zA-Z0-9-_]/g, '_');
            const sanitizedRole = role.replace(/[^a-zA-Z0-9-_]/g, '_');
            const sanitizedTask = task.replace(/[^a-zA-Z0-9-_]/g, '_');
            const fileName = `${sanitizedDepartment}_${sanitizedRole}_${sanitizedTask}.json`;
            const filePath = path.join(pretestDir, fileName);

            // Write to the file
            fs.writeFileSync(filePath, updatedInstructionStr, 'utf-8');

            return res.status(200).json({ message: `Pretest mode: Updated instruction written to ${filePath}` });
        } else {
            // Save the updated instruction back to KV store
            const setResult = await kv.set(instructionKey, updatedInstructionStr);

            if (setResult) {
                return res.status(200).json({ message: `Successfully updated instructions for task "${task}" in role "${role}" of department "${department}".` });
            } else {
                return res.status(500).json({ error: `Failed to save updated instruction for task "${task}".` });
            }
        }
    } catch (error: any) {
        console.error(`Error updating instruction:`, error);
        return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
}
