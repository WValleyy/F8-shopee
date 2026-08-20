import app from '../app.js';
import connectDB from '../config/connect-db.js';

export default async function handler(req, res) {
    await connectDB();
    return app(req, res);
}
