import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        files: ['public/js/**/*.js'],
        languageOptions: {
            globals: globals.browser,
            sourceType: 'module',
        },
        rules: {
            'no-constant-binary-expression': 'error',
            'no-duplicate-imports': 'error',
            'no-unreachable': 'error',
            'no-unused-vars': ['error', {
                args: 'after-used',
                caughtErrors: 'none',
            }],
        },
    },
    {
        files: [
            'app.js',
            'server.js',
            'config/**/*.js',
            'controllers/**/*.js',
            'middlewares/**/*.js',
            'models/**/*.js',
            'routes/**/*.js',
            'services/**/*.js',
            'utils/**/*.js',
            'scripts/**/*.js',
        ],
        languageOptions: {
            globals: globals.node,
            sourceType: 'module',
        },
        rules: {
            'no-constant-binary-expression': 'error',
            'no-duplicate-imports': 'error',
            'no-unreachable': 'error',
            'no-unused-vars': ['error', {
                args: 'after-used',
                caughtErrors: 'none',
            }],
        },
    },
];
