export default function renderAccountPage(req, res, options) {
    const {
        view,
        title,
        data = {},
    } = options;

    if (req.get('X-Partial-Request')) {
        return res.render(`user/${view}`, data);
    }

    return res.render('user/index', {
        title,
        currentPage: view,
        ...data,
    });
}