import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/integration/**/*.test.js'],
        exclude: ['node_modules/**'],
        setupFiles: ['tests/integration/setup.js'],
        fileParallelism: false,
        hookTimeout: 60000,
        testTimeout: 60000,
    },
});
