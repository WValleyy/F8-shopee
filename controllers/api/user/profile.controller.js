import {
    changeUserPassword,
} from '../../../services/auth/auth-account.service.js';
import {
    scheduleAccountDeletion,
} from '../../../services/user/account-deletion.service.js';
import {
    parseChangePasswordInput,
    parseDeleteAccountInput,
} from '../../requests-parser/auth/auth.request.js';
import { parseProfileInput } from '../../requests-parser/user/profile.request.js';
import { updateCurrentUser } from '../../../services/user/profile.service.js';
import { clearAuthCookies } from '../auth/auth-http-state.js';

const profileController = {
    async update(req, res) {
        const fields = parseProfileInput(req.body, req.file);
        const result = await updateCurrentUser(req.authUserId, fields);

        return res.json({ data: result });
    },

    async changePassword(req, res) {
        const { currentPassword, newPassword } = parseChangePasswordInput(req.body);
        await changeUserPassword(
            req.authUserId,
            currentPassword,
            newPassword,
        );

        clearAuthCookies(res);

        return res.json({
            data: {
                requiresReauth: true,
            },
        });
    },

    async deleteAccount(req, res) {
        const { password } = parseDeleteAccountInput(req.body);
        await scheduleAccountDeletion(req.authUserId, password);

        clearAuthCookies(res);
        return res.json({});
    },
};

export default profileController;
