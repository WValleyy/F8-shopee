import { getUserShellById } from '../services/user/profile.service.js';
import { getCartPreview } from '../services/commerce/cart.service.js';
import { getNotificationPreview } from '../services/user/notification.service.js';


function pickUserShellUser(user) {
    if (!user || user.isActive === false)
        return null;

    return {
        _id: user._id,
        userName: user.userName,
        avatar: user.avatar || '',
        isVerified: user.isVerified
    };
}

async function attachHeaderState(req, res, next) {
    if (!req.authUserId) {
        next();
        return;
    }

    
    const [cartPreview, notificationPreview, shellUser] = await Promise.all([
        getCartPreview(req.authUserId),
        getNotificationPreview(req.authUserId),
        !req.authUser
            ? getUserShellById(req.authUserId)
            : pickUserShellUser(req.authUser),
    ]);

    res.locals.cartPreview = cartPreview;
    res.locals.notificationPreview = notificationPreview;
    res.locals.userShellUser = shellUser;
    next();

}

export {
    attachHeaderState,
};
