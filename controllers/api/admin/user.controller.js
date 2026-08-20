import {
    purgeUserAccount,
    setUserActive,
} from '../../../services/admin/user/user-management.service.js';
import { parseUserActivationInput } from '../../requests-parser/admin/user.request.js';

const userManagementController = {
    async setActive(req, res) {
        const { isActive } = parseUserActivationInput(req.body);
        await setUserActive(req.params.id, isActive);

        return res.json({});
    },

    async purge(req, res) {
        await purgeUserAccount(
            req.params.id,
            req.authUserId,
        );

        return res.json({});
    },
};

export default userManagementController;
