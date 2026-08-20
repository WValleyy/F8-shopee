import mongoose, { Schema } from "mongoose";

const userNotificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["EMAIL_VERIFICATION_REQUIRED", "ORDER_COMPLETED"],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userNotificationSchema.index({
  user: 1,
  createdAt: -1,
});

userNotificationSchema.index({
  user: 1,
  readAt: 1,
});

const UserNotification = mongoose.model(
  "UserNotification",
  userNotificationSchema,
);

export default UserNotification;
