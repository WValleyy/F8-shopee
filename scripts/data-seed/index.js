import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

import { seedActivity } from './activity.js';
import dataSeedConfig from './config.js';
import { runPostflight } from './postflight.js';
import { loadProductInfo } from './product-info.js';
import { resetSeedableData } from './reset.js';
import { seedCatalog } from './seed-catalog.js';
import { seedUsers } from './seed-users.js';
import { validateGeneratedActivity } from './validate.js';

function logPhase(number, title) {
    console.log(`\n${'='.repeat(72)}`);
    console.log(`PHASE ${number}/5: ${title}`);
    console.log('='.repeat(72));
}

async function main() {
    logPhase(1, 'Validate generated product data');
    const source = await loadProductInfo(dataSeedConfig.productInfoPath);
    console.table(source.summary);
    console.log('Preflight passed. MongoDB has not been modified yet.');

    logPhase(2, 'Connect to MongoDB and reset seedable data');
    const { default: connectDB } = await import('../../config/connect-db.js');
    await connectDB();
    await resetSeedableData();

    logPhase(3, 'Seed catalog from product-info.json');
    const catalog = await seedCatalog(dataSeedConfig, source.products);

    logPhase(4, 'Seed users and business activity');
    const users = await seedUsers(dataSeedConfig);
    const activity = await seedActivity(
        dataSeedConfig,
        catalog,
        users,
    );
    validateGeneratedActivity(
        dataSeedConfig,
        catalog,
        users,
        activity,
    );

    logPhase(5, 'Verify persisted invariants');
    const summary = await runPostflight(
        source.summary,
        catalog,
        users,
        activity,
    );

    console.log('\nData seed completed successfully.');
    console.table(summary);
    console.log('\nDemo credentials:');
    console.log(
        `USER  ${dataSeedConfig.users.demoAccounts.customer.email} / `
        + dataSeedConfig.users.demoAccounts.customer.password,
    );
    console.log(
        `USER  ${dataSeedConfig.users.demoAccounts.edge.email} / `
        + dataSeedConfig.users.demoAccounts.edge.password,
    );
    console.log(
        `ADMIN ${dataSeedConfig.users.demoAccounts.admin.email} / `
        + dataSeedConfig.users.demoAccounts.admin.password,
    );
}

main()
    .catch((error) => {
        console.error('\nData seed failed.');
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });
