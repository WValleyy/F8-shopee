import {
    listUserSearchHistory,
    recordAndListUserSearchHistory,
    removeUserSearchHistoryItem,
} from '../../../services/user/search-history.service.js';
import { parseSearchHistoryInput } from '../../requests-parser/user/search-history.request.js';

const searchHistoryApiController = {
    async list(req, res) {
        return res.json({
            data: {
                history: await listUserSearchHistory(req.authUserId),
            },
        });
    },

    async record(req, res) {
        const input = parseSearchHistoryInput(req.body);

        return res.json({
            data: {
                history: await recordAndListUserSearchHistory(
                    req.authUserId,
                    input,
                ),
            },
        });
    },

    async remove(req, res) {
        const input = parseSearchHistoryInput(req.body);

        await removeUserSearchHistoryItem(req.authUserId, input.normalizedQuery);
        return res.json({});
    },
};

export default searchHistoryApiController;
