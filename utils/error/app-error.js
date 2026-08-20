import ERROR_CONFIG from '../../config/error.config.js';

const REQUEST_ERROR_OPTION_KEYS = new Set([
    // Values used to build a dynamic message from error.config.js.
    'messageParams',
    // Safe, machine-readable details that may be returned to API clients.
    'meta',
    // Internal diagnostic data used by middleware and application logs.
    'context',
    // The original error that caused this request error.
    'cause',
    // Link and label for the action rendered on an HTML error page.
    'viewAction',
]);

function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

class AppError extends Error {
    constructor(message, {
        statusCode,
        code,
        meta,
        context,
        cause,
        logSeverity,
        viewAction,
    }) {
        super(message, cause ? { cause } : undefined);

        this.name = 'AppError';
        this.statusCode = statusCode;
        this.logSeverity = logSeverity;

        if (code)
            this.code = code;

        if (isPlainObject(meta) && Object.keys(meta).length)
            this.meta = meta;

        if (context)
            this.context = context;

        if (viewAction?.actionHref && viewAction?.actionLabel) {
            this.viewAction = {
                actionHref: viewAction.actionHref,
                actionLabel: viewAction.actionLabel,
            };
        }
    }
}

function isAppError(error) {
    return error instanceof AppError;
}

function isAppErrorCode(error, code) {
    return isAppError(error) && error.code === code;
}

function getRequestErrorDefinition(code) {
    if (typeof code !== 'string' || !code.trim())
        throw new Error('Request error code must be a non-empty string.');

    const definition = ERROR_CONFIG[code];

    if (!definition)
        throw new Error(`Unknown request error code: ${code}`);

    return definition;
}

function createMessageParamsProxy(code, messageParams) {
    if (
        messageParams == null
        || typeof messageParams !== 'object'
        || Array.isArray(messageParams)
    ) {
        throw new Error(
            `Request error message parameters must be an object: ${code}`,
        );
    }

    return new Proxy(messageParams, {
        get(target, property, receiver) {
            if (
                typeof property === 'string'
                && (
                    !Object.prototype.hasOwnProperty.call(target, property)
                    || target[property] == null
                )
            ) {
                throw new Error(
                    `Missing request error message parameter "${property}": ${code}`,
                );
            }

            return Reflect.get(target, property, receiver);
        },
    });
}

function resolveRequestErrorMessage(code, messageParams = {}) {
    const definition = getRequestErrorDefinition(code);
    const message = typeof definition.message === 'function'
        ? definition.message(createMessageParamsProxy(code, messageParams))
        : definition.message;

    if (typeof message !== 'string' || !message.trim())
        throw new Error(`Unable to resolve request error message: ${code}`);

    return message;
}

function requestError(code, options = {}) {
    if (!isPlainObject(options))
        throw new Error('Request error options must be an object.');

    for (const key of Object.keys(options)) {
        if (!REQUEST_ERROR_OPTION_KEYS.has(key))
            throw new Error(`Unsupported request error option: ${key}`);
    }

    const {
        messageParams,
        meta,
        context,
        cause,
        viewAction,
    } = options;
    const definition = getRequestErrorDefinition(code);
    const message = resolveRequestErrorMessage(code, messageParams);

    return new AppError(message, {
        statusCode: definition.statusCode,
        code,
        meta,
        context,
        cause,
        viewAction,
        logSeverity: null,
    });
}

function incidentError(message, options = {}) {
    return new AppError(message, {
        ...options,
        statusCode: options.statusCode || 500,
        logSeverity: options.logSeverity || 'error',
    });
}

export {
    AppError,
    incidentError,
    isAppError,
    isAppErrorCode,
    requestError,
    resolveRequestErrorMessage,
};
