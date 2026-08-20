import argon2 from 'argon2';
import mongoose from 'mongoose';

import User from '../../models/user/user.model.js';
import UserAddress from '../../models/user/user-address.model.js';
import { dateDaysAgo } from '../../utils/date.js';
import { createRandom } from '../../utils/random.js';

function makePhone(index) {
    return `09${String(20000000 + index * 1739).slice(-8)}`;
}

function buildAddress(user, index, random, addressPool) {
    const [province, ward, baseDetail] = addressPool[
        index % addressPool.length
    ];
    const detail = index < addressPool.length
        ? baseDetail
        : `${baseDetail}, căn ${random.int(1, 40)}`;

    return {
        _id: new mongoose.Types.ObjectId(),
        user: user._id,
        fullName: user.name,
        phone: user.phone || makePhone(index),
        province,
        ward,
        detail,
        isDefault: true,
        createdAt: user.createdAt,
        updatedAt: user.createdAt,
    };
}

function stripPassword(account) {
    const { password, ...profile } = account;

    if (!password)
        throw new Error(`Demo password is missing for ${account.email}.`);

    return profile;
}

async function seedUsers(config) {
    const { demoAccounts, namePool, addressPool } = config.users;
    const random = createRandom();
    const syntheticPasswordHash = await argon2.hash('seed-only-account');
    const demoPasswordHash = await argon2.hash('123456');
    const synthetic = [];

    for (let index = 0; index < config.syntheticUserCount; index += 1) {
        const createdAt = dateDaysAgo(
            random.int(120, 340),
            random.int(8, 20),
        );
        synthetic.push({
            _id: new mongoose.Types.ObjectId(),
            userName: `seed_user_${String(index + 1).padStart(2, '0')}`,
            name: namePool[index % namePool.length],
            email: `seed.user${String(index + 1).padStart(2, '0')}@example.com`,
            passwordHash: syntheticPasswordHash,
            avatar: '',
            avatarPublicId: '',
            phone: makePhone(index + 1),
            gender: index % 2 === 0 ? 'female' : 'male',
            birthday: null,
            role: 'USER',
            isVerified: true,
            isActive: true,
            purgeAfter: null,
            lastLoginAt: null,
            createdAt,
            updatedAt: createdAt,
        });
    }

    const demoCustomerCreatedAt = dateDaysAgo(300, 10);
    const demoEdgeCreatedAt = dateDaysAgo(280, 11);
    const adminCreatedAt = dateDaysAgo(360, 9);
    const demoCustomer = {
        _id: new mongoose.Types.ObjectId(),
        ...stripPassword(demoAccounts.customer),
        passwordHash: demoPasswordHash,
        avatar: '',
        avatarPublicId: '',
        role: 'USER',
        isVerified: true,
        isActive: true,
        purgeAfter: null,
        lastLoginAt: dateDaysAgo(1, 21),
        createdAt: demoCustomerCreatedAt,
        updatedAt: demoCustomerCreatedAt,
    };
    const demoEdge = {
        _id: new mongoose.Types.ObjectId(),
        ...stripPassword(demoAccounts.edge),
        passwordHash: demoPasswordHash,
        avatar: '',
        avatarPublicId: '',
        role: 'USER',
        isVerified: true,
        isActive: true,
        purgeAfter: null,
        lastLoginAt: dateDaysAgo(2, 18),
        createdAt: demoEdgeCreatedAt,
        updatedAt: demoEdgeCreatedAt,
    };
    const admin = {
        _id: new mongoose.Types.ObjectId(),
        ...stripPassword(demoAccounts.admin),
        passwordHash: demoPasswordHash,
        avatar: '',
        avatarPublicId: '',
        role: 'ADMIN',
        isVerified: true,
        isActive: true,
        purgeAfter: null,
        lastLoginAt: dateDaysAgo(1, 8),
        createdAt: adminCreatedAt,
        updatedAt: adminCreatedAt,
    };

    await User.insertMany([
        ...synthetic,
        demoCustomer,
        demoEdge,
        admin,
    ]);

    const addressUsers = [...synthetic, demoCustomer, demoEdge];
    const addressDocs = addressUsers.map((user, index) => (
        buildAddress(user, index, random, addressPool)
    ));

    await UserAddress.insertMany(addressDocs);

    return {
        synthetic,
        demoCustomer,
        demoEdge,
        admin,
        addresses: addressDocs,
        addressByUserId: new Map(addressDocs.map(address => [
            address.user.toString(),
            address,
        ])),
    };
}

export { seedUsers };
