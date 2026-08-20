import inputLimits from '../../../config/input-limits.js';
import {
    readBoolean,
    readObjectBody,
    readRequiredString,
} from '../shared/request-value.js';
import { readPhone } from './profile.request.js';

function readAddressFields(body) {
    return {
        fullName: readRequiredString(body.fullName, 'fullName', {
            maxLength: inputLimits.address.fullNameMaxLength,
        }),
        phone: readPhone(body.phone),
        province: readRequiredString(body.province, 'province', {
            maxLength: inputLimits.address.provinceMaxLength,
        }),
        ward: readRequiredString(body.ward, 'ward', {
            maxLength: inputLimits.address.wardMaxLength,
        }),
        addressLine: readRequiredString(body.addressLine, 'addressLine', {
            maxLength: inputLimits.address.detailMaxLength,
        }),
        isDefault: readBoolean(body.isDefault, 'isDefault'),
    };
}

function parseCreateAddressInput(rawBody) {
    const body = readObjectBody(rawBody);
    return readAddressFields(body);
}

function parseUpdateAddressInput(rawBody) {
    const body = readObjectBody(rawBody);
    return readAddressFields(body);
}

export {
    parseCreateAddressInput,
    parseUpdateAddressInput,
};
