function buildPagination({ page = 1, limit = 10, totalItems = 0 } = {}) {
    const totalPages = totalItems === 0
        ? 0
        : Math.ceil(totalItems / limit);
    const currentPage = totalPages === 0
        ? 1
        : Math.min(page, totalPages);

    return {
        page: currentPage,
        totalPages,
    };
}

export {
    buildPagination,
};
