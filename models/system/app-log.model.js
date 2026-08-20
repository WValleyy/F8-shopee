import mongoose, { Schema } from 'mongoose';

import appLogConfig from '../../config/app-log.js';

const appLogSchema = new Schema(
    {
        scope: {
            type: String,
            required: true,
            trim: true,
            maxlength: appLogConfig.scopeMaxLength,
            index: true,
        },
        severity: {
            type: String,
            enum: ['info', 'warning', 'error'],
            required: true,
            index: true,
        },
        message: {
            type: String,
            default: '',
            maxlength: appLogConfig.messageMaxLength,
        },
        context: {
            type: Schema.Types.Mixed,
            default: {},
        },
        stack: {
            type: String,
            default: '',
            maxlength: appLogConfig.stackMaxLength,
        },
        searchText: {
            type: String,
            required: true,
            maxlength: appLogConfig.searchTextMaxLength,
            select: false,
        },
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: false,
        },
    },
);

appLogSchema.index({ createdAt: -1 });
appLogSchema.index({ scope: 1, createdAt: -1 });

const AppLog = mongoose.model('AppLog', appLogSchema);

export default AppLog;
