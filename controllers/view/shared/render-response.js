async function renderPartial(
    res,
    {
        view,
        data,
        payload,
    },
) {
    const html = await new Promise((resolve, reject) => {
        res.render(
            view,
            {
                layout: false,
                ...data,
            },
            (error, renderedHtml) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(renderedHtml);
            },
        );
    });

    return res.json({
        html,
        ...payload,
    });
}

async function renderPageResponse(req, res, options) {
    const {
        layout,
        pageView,
        collectionView,
        pageData,
    } = options;

    const partialTarget = req.get('X-Partial-Target');

    if (!partialTarget) {
        return res.render(pageView, {
            ...(layout ? { layout } : {}),
            ...pageData,
        });
    }

    if (partialTarget === 'paginated-collection' && collectionView) {
        return renderPartial(res, {
            view: collectionView,
            data: pageData,
            payload: {
                pagination: pageData.pagination,
            },
        });
    }

    return renderPartial(res, {
        view: pageView,
        data: pageData,
        payload: {
            title: pageData.title,
            currentPage: pageData.currentPage,
            activeSection: pageData.activeSection,
        },
    });
}

export {
    renderPageResponse,
    renderPartial,
};
