import mongoose from 'mongoose';

import inputLimits from '../../config/input-limits.js';
import UserAddress from '../../models/user/user-address.model.js';
import User from '../../models/user/user.model.js';
import { requestError } from '../../utils/error/app-error.js';

async function listAddresses(userId) {
    const addresses = await UserAddress
        .find({ user: userId })
        .select('fullName phone province ward detail isDefault')
        .sort({ isDefault: -1, createdAt: -1, _id: -1 })
        .lean();

    return addresses.map(address => {
        return {
            id: address._id.toString(),
            fullName: address.fullName,
            phone: address.phone,
            province: address.province,
            ward: address.ward,
            addressLine: address.detail,
            isDefault: address.isDefault,
        };
    });
}

async function createUserAddress(userId, input) {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await claimActiveUser(userId, session);

            const addressCount = await UserAddress.countDocuments({
                user: userId,
            }).session(session);

            if (addressCount >= inputLimits.address.maxPerUser) {
                throw requestError('ADDRESS_LIMIT_REACHED', {
                    messageParams: { limit: inputLimits.address.maxPerUser },
                });
            }

            const shouldBeDefault = input.isDefault || addressCount === 0;

            if (shouldBeDefault) {
                await UserAddress.updateMany(
                    { user: userId, isDefault: true },
                    { $set: { isDefault: false } },
                    { session },
                );
            }

            await UserAddress.create([{
                user: userId,
                fullName: input.fullName,
                phone: input.phone,
                province: input.province,
                ward: input.ward,
                detail: input.addressLine,
                isDefault: shouldBeDefault,
            }], { session });
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw requestError('DEFAULT_ADDRESS_STATE_CHANGED', {
                cause: error,
            });
        }

        throw error;
    } finally {
        await session.endSession();
    }
}

async function updateUserAddress(userId, addressId, input) {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await claimActiveUser(userId, session);

            const address = await UserAddress.findOne({
                _id: addressId,
                user: userId,
            }).session(session);

            if (!address)
                throw requestError('ADDRESS_NOT_FOUND');

            address.fullName = input.fullName;
            address.phone = input.phone;
            address.province = input.province;
            address.ward = input.ward;
            address.detail = input.addressLine;
            if (input.isDefault) {
                await UserAddress.updateMany(
                    {
                        user: userId,
                        isDefault: true,
                        _id: { $ne: addressId },
                    },
                    { $set: { isDefault: false } },
                    { session },
                );
            }

            address.isDefault = input.isDefault || address.isDefault;
            await address.save({ session });
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw requestError('DEFAULT_ADDRESS_STATE_CHANGED', {
                cause: error,
            });
        }

        throw error;
    } finally {
        await session.endSession();
    }
}

async function deleteAddress(userId, addressId) {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await claimActiveUser(userId, session);

            const address = await UserAddress.findOne({
                _id: addressId,
                user: userId,
            }).session(session);

            if (!address)
                throw requestError('ADDRESS_NOT_FOUND');

            if (address.isDefault)
                throw requestError('DEFAULT_ADDRESS_CANNOT_DELETE');

            await UserAddress.deleteOne(
                { _id: addressId, user: userId },
                { session },
            );
        });
    } finally {
        await session.endSession();
    }
}

async function setDefaultAddress(userId, addressId) {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            await claimActiveUser(userId, session);

            const addressExists = await UserAddress.exists({
                _id: addressId,
                user: userId,
            }).session(session);

            if (!addressExists)
                throw requestError('ADDRESS_NOT_FOUND');

            await UserAddress.updateMany(
                {
                    user: userId,
                    isDefault: true,
                    _id: { $ne: addressId },
                },
                { $set: { isDefault: false } },
                { session },
            );

            await UserAddress.updateOne(
                { _id: addressId, user: userId },
                { $set: { isDefault: true } },
                { session },
            );
        });
    } catch (error) {
        if (error?.code === 11000) {
            throw requestError('DEFAULT_ADDRESS_CHANGED', {
                cause: error,
            });
        }

        throw error;
    } finally {
        await session.endSession();
    }
}

async function claimActiveUser(userId, session) {
    const result = await User.updateOne(
        {
            _id: userId,
            role: 'USER',
            isActive: true,
            purgeAfter: null,
        },
        { $currentDate: { updatedAt: true } },
        { session },
    );

    if (result.matchedCount !== 1)
        throw requestError('USER_NOT_FOUND');
}

export {
    createUserAddress,
    deleteAddress,
    listAddresses,
    setDefaultAddress,
    updateUserAddress,
};
