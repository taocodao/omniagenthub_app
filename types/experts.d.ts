declare module 'experts' {
    export class Assistant {
        static create(config: {
            name: string;
            instructions: string;
            model: string;
            temperature: number;
            apiKey: string;
        }): Promise<Assistant>;

        ask(message: string, threadId: string): Promise<string>;
        addAssistantTool(tool: Tool): void;  // Add this line
    }

    export class Thread {
        static create(): Promise<Thread>;
        id: string;
    }

    export class Tool {
        constructor(config: {
            name: string;
            instructions: string;
            parentsTools?: {
                type: string;
                function: {
                    name: string;
                    description: string;
                    parameters: {
                        type: string;
                        properties: { [key: string]: { type: string } };
                        required: string[];
                    };
                };
            }[];
        });
    }
}
