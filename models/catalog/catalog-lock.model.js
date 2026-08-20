import mongoose, { Schema } from 'mongoose';

const adminResourceLockSchema = new Schema(
    {
        _id: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

const AdminResourceLock = mongoose.model(
    'AdminResourceLock',
    adminResourceLockSchema,
);

export default AdminResourceLock;
