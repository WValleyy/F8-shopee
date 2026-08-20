import mongoose from 'mongoose';

import { requestError } from '../../../utils/error/app-error.js';

function readObjectBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
        throw requestError('REQUEST_BODY_INVALID');

    return body;
}

function readString(value, label, {
    required = false,
    trim = true,
    collapseWhitespace = false,
    minLength = 0,
    maxLength = Infinity,
    defaultValue = '',
} = {}) {
    if (value == null) {
        if (required)
            throw requestError('FIELD_REQUIRED', {
                messageParams: { fieldLabel: label },
            });
        return defaultValue;
    }

    if (typeof value !== 'string')
        throw requestError('FIELD_MUST_BE_STRING', {
            messageParams: { fieldLabel: label },
        });

    let result = trim ? value.trim() : value;
    if (collapseWhitespace)
        result = result.replace(/\s+/g, ' ');

    if (required && !result)
        throw requestError('FIELD_REQUIRED', {
            messageParams: { fieldLabel: label },
        });
    if (result.length < minLength || result.length > maxLength) {
        throw requestError('FIELD_LENGTH_INVALID', {
            messageParams: { fieldLabel: label, minLength, maxLength },
        });
    }

    return result;
}

function readRequiredString(value, label, options = {}) {
    return readString(value, label, { ...options, required: true });
}

function readOptionalString(value, label, options = {}) {
    return readString(value, label, options);
}

function readBoolean(value, label, defaultValue = false) {
    if (value == null)
        return defaultValue;
    if (typeof value !== 'boolean')
        throw requestError('FIELD_MUST_BE_BOOLEAN', {
            messageParams: { fieldLabel: label },
        });
    return value;
}

function readFormBoolean(value, label, defaultValue = false) {
    if (value == null || value === '')
        return defaultValue;
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    throw requestError('FIELD_MUST_BE_BOOLEAN', {
        messageParams: { fieldLabel: label },
    });
}

function readNumber(value, label, {
    required = true,
    integer = false,
    min = -Infinity,
    max = Infinity,
    defaultValue = null,
} = {}) {
    if (value == null || value === '') {
        if (required)
            throw requestError('FIELD_REQUIRED', {
                messageParams: { fieldLabel: label },
            });
        return defaultValue;
    }
    if (typeof value !== 'number' || !Number.isFinite(value))
        throw requestError('FIELD_MUST_BE_NUMBER', {
            messageParams: { fieldLabel: label },
        });
    if (integer && !Number.isSafeInteger(value))
        throw requestError('FIELD_MUST_BE_INTEGER', {
            messageParams: { fieldLabel: label },
        });
    if (value < min || value > max)
        throw requestError('FIELD_OUT_OF_RANGE', {
            messageParams: { fieldLabel: label },
        });
    return value;
}

function readFormNumber(value, label, options = {}) {
    if (value == null || value === '') {
        return readNumber(value, label, options);
    }
    if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value.trim()))
        throw requestError('FIELD_MUST_BE_NUMBER', {
            messageParams: { fieldLabel: label },
        });
    return readNumber(Number(value), label, options);
}

function readEnum(value, label, values, {
    defaultValue,
    transform = result => result,
} = {}) {
    const result = value == null || value === ''
        ? defaultValue
        : readRequiredString(value, label);
    const canonical = transform(result);
    if (!values.includes(canonical))
        throw requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: label },
        });
    return canonical;
}

function readObjectId(value, label, { required = true, defaultValue = '' } = {}) {
    if (value == null || value === '') {
        if (required)
            throw requestError('FIELD_REQUIRED', {
                messageParams: { fieldLabel: label },
            });
        return defaultValue;
    }
    if (typeof value !== 'string' || !mongoose.isValidObjectId(value))
        throw requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: label },
        });
    return value;
}

function readObjectIdArray(value, label, {
    required = true,
    maxItems = Infinity,
} = {}) {
    if ((value == null || value === '') && !required)
        return [];
    if (!Array.isArray(value))
        throw requestError('FIELD_MUST_BE_ARRAY', {
            messageParams: { fieldLabel: label },
        });
    const result = [...new Set(value.map((item, index) => (
        readObjectId(item, `${label}[${index}]`)
    )))];
    if ((required && !result.length) || result.length > maxItems)
        throw requestError('FIELD_ITEM_COUNT_INVALID', {
            messageParams: { fieldLabel: label },
        });
    return result;
}

function readPositiveIntegerQuery(value, label = 'page', defaultValue = 1) {
    if (value == null || value === '')
        return defaultValue;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))
        throw requestError('FIELD_MUST_BE_POSITIVE_INTEGER', {
            messageParams: { fieldLabel: label },
        });
    const result = Number(value);
    if (!Number.isSafeInteger(result))
        throw requestError('FIELD_MUST_BE_POSITIVE_INTEGER', {
            messageParams: { fieldLabel: label },
        });
    return result;
}

function readFormJsonArray(value, label, { required = false } = {}) {
    if (value == null || value === '') {
        if (required)
            throw requestError('FIELD_REQUIRED', {
                messageParams: { fieldLabel: label },
            });
        return [];
    }
    if (typeof value !== 'string')
        throw requestError('FIELD_MUST_BE_JSON', {
            messageParams: { fieldLabel: label },
        });
    try {
        const result = JSON.parse(value);
        if (!Array.isArray(result))
            throw new Error();
        return result;
    } catch {
        throw requestError('FIELD_MUST_BE_JSON_ARRAY', {
            messageParams: { fieldLabel: label },
        });
    }
}

export {
    readBoolean,
    readEnum,
    readFormBoolean,
    readFormJsonArray,
    readFormNumber,
    readNumber,
    readObjectBody,
    readObjectId,
    readObjectIdArray,
    readOptionalString,
    readPositiveIntegerQuery,
    readRequiredString,
};
