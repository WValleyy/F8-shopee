import {
    createUserAddress,
    deleteAddress,
    setDefaultAddress,
    updateUserAddress,
} from '../../../services/user/address.service.js';
import {
    parseCreateAddressInput,
    parseUpdateAddressInput,
} from '../../requests-parser/user/address.request.js';

const addressController = {
    async create(req, res) {
        const input = parseCreateAddressInput(req.body);
        await createUserAddress(req.authUserId, input);
        return res.json({});
    },

    async remove(req, res) {
        await deleteAddress(req.authUserId, req.params.id);
        return res.json({});
    },

    async update(req, res) {
        const input = parseUpdateAddressInput(req.body);
        await updateUserAddress(req.authUserId, req.params.id, input);
        return res.json({});
    },

    async setDefault(req, res) {
        await setDefaultAddress(req.authUserId, req.params.id);
        return res.json({});
    },
};

export default addressController;
