import dotenv from 'dotenv';

const result = dotenv.config({
    path: '.env.test',
    override: true,
    quiet: true,
});

if (result.error) {
    throw new Error(
        'Integration tests require .env.test with a dedicated MongoDB test database.',
    );
}
