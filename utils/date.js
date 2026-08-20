function addSeconds(date, seconds) {
    return new Date(date.getTime() + (seconds * 1000));
}

function addDays(date, days) {
    return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
}

function dateDaysAgo(days, hour = 10) {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    date.setDate(date.getDate() - days);
    return date;
}

export {
    addSeconds,
    addDays,
    dateDaysAgo,
};
