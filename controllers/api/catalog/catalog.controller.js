import { searchProductSuggestions } from '../../../services/catalog/catalog-browse.service.js';
import { parseSearchSuggestionQuery } from '../../requests-parser/catalog/catalog.request.js';

const catalogApiController = {
    async suggestions(req, res) {
        const { q: query } = parseSearchSuggestionQuery(req.query);
        const suggestions = await searchProductSuggestions(query, 6);

        return res.json({
            data: { suggestions },
        });
    },
};

export default catalogApiController;
