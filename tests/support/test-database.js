import mongoose from 'mongoose';

import env from '../../config/load-env.js';
import connectDB from '../../config/connect-db.js';

const TEST_DATABASE_SUFFIX = '-test';

function getTestDatabaseConfig() {
    const dbName = env.database.name;

    if (!dbName.endsWith(TEST_DATABASE_SUFFIX)) {
        throw new Error(
            `Integration tests require MONGODB_DB_NAME to end with ${TEST_DATABASE_SUFFIX}.`,
        );
    }

    return {
        uri: env.database.uri,
        dbName,
    };
}

function connectTestDatabase() {
    return connectDB(getTestDatabaseConfig());
}

async function disconnectTestDatabase() {
    if (mongoose.connection.readyState !== 0)
        await mongoose.disconnect();
}

export {
    connectTestDatabase,
    disconnectTestDatabase,
};
