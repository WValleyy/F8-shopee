import app from './app.js';
import env from './config/load-env.js';
import connectDB from './config/connect-db.js';
import { logAppEvent } from './utils/error/app-error-logger.js';

const PORT = env.port;

function startListening(port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log(`Server is running at http://localhost:${port}`);
            resolve(server);
        });

        server.on('error', reject);
    });
}

async function startServer() {
    let connection = null;

    try {
        connection = await connectDB();
        await startListening(PORT);
    } catch (error) {
        await logAppEvent('server:start-failed', 'error', {
            port: PORT,
            error: error?.message || String(error),
            stack: error?.stack || '',
        });

        if (connection?.readyState === 1)
            await connection.close();

        process.exit(1);
    }
}

startServer();
