function normalizePhone(value) {
    return String(value || '')
        .trim()
        .replace(/[\s-]+/g, '');
}

export {
    normalizePhone,
};
