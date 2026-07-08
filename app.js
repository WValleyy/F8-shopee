import express from 'express';
import expressLayouts from 'express-ejs-layouts';

import homeRoutes from './routes/views/home.routes.js';
import accountRoutes from './routes/views/account.routes.js';

const app = express();

// ================= Middleware =================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static('public'));

// ================= View Engine =================

app.use(expressLayouts);

app.set('view engine', 'ejs');
app.set('layout', 'layout');

// ================= Routes =================

app.use('/', homeRoutes);
app.use('/account', accountRoutes);

// ================= 404 =================

app.use((req, res) => {
    res.status(404).render('404', {
        title: '404 - Page Not Found',
    });
});

export default app;