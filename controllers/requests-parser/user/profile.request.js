import inputLimits from '../../../config/input-limits.js';
import { requestError } from '../../../utils/error/app-error.js';
import { normalizePhone } from '../../../utils/phone.js';
import {
    readEnum,
    readObjectBody,
    readRequiredString,
} from '../shared/request-value.js';

function readPhone(value) {
    if (typeof value !== 'string')
        throw requestError('PHONE_MUST_BE_STRING');
    const phone = normalizePhone(value);
    if (
        phone.length > inputLimits.user.phoneMaxLength
        || !new RegExp(
            `^\\+?\\d{${inputLimits.phone.minDigits},${inputLimits.phone.maxDigits}}$`,
        ).test(phone)
    ) {
        throw requestError('INVALID_PHONE');
    }
    return phone;
}

function readBirthday(value) {
    if (value === '')
        return null;
    const birthday = readRequiredString(value, 'Birthday');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday))
        throw requestError('INVALID_BIRTHDAY');
    const date = new Date(`${birthday}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== birthday)
        throw requestError('INVALID_BIRTHDAY');
    return date;
}

function parseProfileInput(rawBody, avatarSource = null) {
    const body = readObjectBody(rawBody);
    const input = {};

    if (Object.hasOwn(body, 'userName')) {
        const userName = readRequiredString(body.userName, 'Username', {
            minLength: inputLimits.user.userNameMinLength,
            maxLength: inputLimits.user.userNameMaxLength,
        });
        if (/\s/.test(userName))
            throw requestError('USERNAME_CONTAINS_SPACES');
        input.userName = userName;
    }
    if (Object.hasOwn(body, 'name')) {
        input.name = readRequiredString(body.name, 'Name', {
            maxLength: inputLimits.user.nameMaxLength,
        });
    }
    if (Object.hasOwn(body, 'phone'))
        input.phone = readPhone(body.phone);
    if (Object.hasOwn(body, 'gender')) {
        input.gender = readEnum(
            body.gender,
            'Gender',
            ['male', 'female', 'other'],
        );
    }
    if (Object.hasOwn(body, 'birthday'))
        input.birthday = readBirthday(body.birthday);
    if (avatarSource)
        input.avatarSource = avatarSource;
    if (!Object.keys(input).length)
        throw requestError('NO_FIELDS_TO_UPDATE');
    return input;
}

export {
    parseProfileInput,
    readPhone,
};
