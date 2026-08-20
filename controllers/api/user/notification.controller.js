import {
    getNotificationPreview,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from '../../../services/user/notification.service.js';

const notificationApiController = {
    async markRead(req, res) {
        await markNotificationAsRead(
            req.authUserId,
            req.params.id,
        );

        return res.json({
            data: {
                notificationPreview: await getNotificationPreview(
                    req.authUserId,
                ),
            },
        });
    },

    async markAllRead(req, res) {
        await markAllNotificationsAsRead(req.authUserId);
        return res.json({
            data: {
                notificationPreview: await getNotificationPreview(
                    req.authUserId,
                ),
            },
        });
    },
};

export default notificationApiController;
