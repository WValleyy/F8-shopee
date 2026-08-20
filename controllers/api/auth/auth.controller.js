import {
    loginUser,
    registerUser,
} from '../../../services/auth/auth-account.service.js';
import {
    parseLoginInput,
    parseRegisterInput,
} from '../../requests-parser/auth/auth.request.js';
import {
    getSessionMetadata,
    setAuthCookies,
} from './auth-http-state.js';

const authController = {
    async register(req, res) {
        const input = parseRegisterInput(req.body);
        const session = await registerUser(
            {
                name: input.name,
                email: input.email,
                password: input.password,
            },
            getSessionMetadata(req, false),
        );

        if (!session) {
            return res.json({
                data: {
                    authenticated: false,
                    message: 'Tài khoản đã được tạo, vui lòng đăng nhập để tiếp tục.',
                },
            });
        }

        setAuthCookies(res, session);
        return res.json({
            data: {
                authenticated: true,
            },
        });
    },

    async login(req, res) {
        const input = parseLoginInput(req.body);

        const session = await loginUser(
            input.email,
            input.password,
            {
                ...getSessionMetadata(req, input.rememberMe),
                replaceOldest: input.force,
            },
        );

        setAuthCookies(res, session);
        return res.json({});
    },
};

export default authController;
