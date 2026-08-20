import mongoose from 'mongoose';

import { requestError } from '../utils/error/app-error.js';

function validateObjectIdParam(paramName, label = paramName) {
    return function objectIdParamValidator(req, res, next) {
        if (mongoose.isValidObjectId(req.params[paramName]))
            return next();

        return next(requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: label },
        }));
    };
}

function validateObjectIdBody(fieldName, label = fieldName) {
    return function objectIdBodyValidator(req, res, next) {
        if (mongoose.isValidObjectId(req.body?.[fieldName]))
            return next();

        return next(requestError('FIELD_INVALID', {
            messageParams: { fieldLabel: label },
        }));
    };
}

export {
    validateObjectIdBody,
    validateObjectIdParam,
};
