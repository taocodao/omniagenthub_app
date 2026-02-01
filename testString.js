{
    "compilerOptions": {
        "allowImportingTsExtensions": true,
            "target": "es2022",
                "lib": [
                    "ES2020",
                    "DOM"
                ],
                    "types": [
                        "node"
                    ],
                        "allowJs": true,
                            "skipLibCheck": true,
                                "strict": true,
                                    "forceConsistentCasingInFileNames": true,
                                        "noEmit": true,
                                            "esModuleInterop": true,
                                                "module": "esnext",
                                                    "moduleResolution": "bundler",
                                                        "resolveJsonModule": true,
                                                            "isolatedModules": true,
                                                                "incremental": true,
                                                                    "sourceMap": false,
                                                                        "jsx": "preserve",
                                                                            "allowSyntheticDefaultImports": true,
                                                                                "paths": {
            "@/*": [
                "./src/*"
            ],
                "@public/*": [
                    "./public/*"
                ]
        },
        "typeRoots": [
            "./node_modules/@types",
            "./types"
        ],
            "plugins": [
                {
                    "name": "next"
                }
            ]
    },
    "include": [
        "next-env.d.ts",
        "**/*.ts",
        "**/*.tsx",
        "app",
        ".next/types/**/*.ts",
        "components/SendFunds.backup",
        "pages/nameTranslate.backup",
        "pages/api/get_task_description.0926",
        "pages/api/get_content_by_language.0926",
        "components/OpenWebsiteToast.backup",
        "pages/api/convert-prompt,1015",
        "pages/convert-prompt.1009",
        "pages/convert-prompt.1019.tsx",
        "pages/api/getCompanyUsers.0211",
        "pages/ChatHome.0201",
        "pages/api/sendEmail.0414",
        "pages/api/send-payment.0414"
    ],
        "exclude": [
            "node_modules"
        ]
}
