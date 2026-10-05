import globals from "globals";

const unusedVarsRule = [
    "error",
    {
        vars: "all",
        args: "none",
        caughtErrors: "none",
        ignoreRestSiblings: true,
        varsIgnorePattern: "^_"
    }
];

export default [
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            "js/qr-code-styling.js",
            "js/workbox-window.js"
        ]
    },
    {
        files: ["js/**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.es2024,
                QRCodeStyling: "readonly",
                __ENV__: "readonly"
            }
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": unusedVarsRule
        }
    },
    {
        files: ["tests/**/*.js", "scripts/**/*.js", "server/**/*.js", "*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.es2024
            }
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": unusedVarsRule
        }
    },
    {
        files: ["service-worker-src.js", "service-worker.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.serviceworker,
                ...globals.es2024,
                workbox: "readonly",
                importScripts: "readonly"
            }
        },
        rules: {
            "no-undef": "error",
            "no-unused-vars": unusedVarsRule
        }
    }
];
