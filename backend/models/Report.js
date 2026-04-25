const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    description: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'reviewed'], default: 'pending' },
    adminNote: { type: String, default: '' },
    actionTaken: { type: String, enum: ['dismiss', 'warn_user', 'ban_user'], default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
