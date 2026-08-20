import User from '../../models/user/user.model.js';
import { uploadFolders } from '../../config/upload-image.js';
import {
    cleanupUploadedImage,
    createPendingCloudinaryImage,
    uploadCloudinaryImage,
} from '../image/cloudinary-image.service.js';
import { requestError } from '../../utils/error/app-error.js';

async function getUserShellById(id) {
    return User
        .findOne({ _id: id, isActive: true })
        .select('userName avatar isVerified')
        .lean();
}

async function getUserByEmailWithPassword(email) {
    const user = await User
        .findOne({ email })
        .select('+passwordHash')
        .lean();

    return user;
}

async function updateCurrentUser(userId, data) {
    const { avatarSource, ...updateFields } = data;
    const activeUserFilter = {
        _id: userId,
        role: 'USER',
        isActive: true,
        purgeAfter: null,
    };

    if (!avatarSource) {
        const user = await User.findOneAndUpdate(
            activeUserFilter,
            { $set: updateFields },
            {
                projection: { _id: 1 },
                returnDocument: 'after',
                runValidators: true,
            },
        ).lean();

        if (!user)
            throw requestError('USER_NOT_FOUND');

        return { avatar: null };
    }

    const pendingAvatar = createPendingCloudinaryImage(avatarSource, {
        folder: `${uploadFolders.avatar}/${userId}`,
    });

    // Intentional best-effort upload: MongoDB remains authoritative, so an
    // unavailable Cloudinary asset leaves the persisted URL unchanged.
    const previousUser = await User.findOneAndUpdate(
        activeUserFilter,
        {
            $set: {
                ...updateFields,
                avatar: pendingAvatar.url,
                avatarPublicId: pendingAvatar.publicId,
            },
        },
        {
            projection: { avatarPublicId: 1 },
            returnDocument: 'before',
            runValidators: true,
        },
    ).lean();

    if (!previousUser)
        throw requestError('USER_NOT_FOUND');

    await uploadCloudinaryImage(pendingAvatar.source, {
        publicId: pendingAvatar.publicId,
        rollback: false,
    });

    if (
        previousUser.avatarPublicId
        && previousUser.avatarPublicId !== pendingAvatar.publicId
    ) {
        await cleanupUploadedImage(
            previousUser.avatarPublicId,
            'avatar-old-image-cleanup-failed',
        );
    }

    return { avatar: pendingAvatar.url };
}

export {
    getUserByEmailWithPassword,
    getUserShellById,
    updateCurrentUser,
};
