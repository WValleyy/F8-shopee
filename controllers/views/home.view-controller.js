const homeViewController = {
    home(req, res) {
        res.render('home');
    },

    product(req, res) {
        res.render('product');
    },

    cart(req, res) {
        res.render('cart');
    },

    checkout(req, res) {
        res.render('checkout');
    }
};

export default homeViewController;