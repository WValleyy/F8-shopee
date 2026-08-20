import commerceConfig from '../../../config/commerce.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const ORDER_TRANSITIONS = Object.freeze({
    cancel: Object.freeze({
        fromStatuses: Object.freeze(['SHIPPING']),
        toStatus: 'CANCELLED',
        allowedActors: Object.freeze(['USER', 'ADMIN']),
    }),
    complete: Object.freeze({
        fromStatuses: Object.freeze(['SHIPPING']),
        toStatus: 'COMPLETED',
        allowedActors: Object.freeze(['USER', 'ADMIN']),
    }),
});

function getOrderTransition(action, actor) {
    const transition = ORDER_TRANSITIONS[action];

    if (!transition?.allowedActors.includes(actor))
        return null;

    return {
        fromStatuses: transition.fromStatuses,
        toStatus: transition.toStatus,
    };
}

function listAllowedOrderActions(status, actor) {
    return Object.entries(ORDER_TRANSITIONS)
        .filter(([, transition]) => (
            transition.allowedActors.includes(actor)
            && transition.fromStatuses.includes(status)
        ))
        .map(([action]) => action);
}

function isOrderReturnWindowOpen(order, now = new Date()) {
    if (order.status !== 'COMPLETED' || !order.completedAt)
        return false;

    const completedTime = new Date(order.completedAt).getTime();
    const deadline = completedTime
        + (commerceConfig.return.windowDays * DAY_MS);

    return now.getTime() <= deadline;
}

export {
    getOrderTransition,
    isOrderReturnWindowOpen,
    listAllowedOrderActions,
};
