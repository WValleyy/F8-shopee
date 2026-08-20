import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/unit/**/*.test.js'],
        exclude: [
            'node_modules/**',
            'tests/integration/**',
        ],
        fileParallelism: false,
        hookTimeout: 5000,
        testTimeout: 5000,
    },
});
