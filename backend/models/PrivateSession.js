const mongoose = require('mongoose');

const privateSessionSchema = new mongoose.Schema(
  {
    stream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream', required: true, index: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    roomName: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'active', 'ended', 'rejected', 'cancelled', 'expired'],
      default: 'pending',
      index: true,
    },
    requestedMinutes: { type: Number, required: true, min: 1 },
    ratePerMinute: { type: Number, required: true, min: 1 },
    totalCredits: { type: Number, required: true, min: 1 },
    reservedCredits: { type: Number, default: 0, min: 0 },
    billedMinutes: { type: Number, default: 0, min: 0 },
    billedCredits: { type: Number, default: 0, min: 0 },
    confirmedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    lastBilledAt: { type: Date, default: null },
    lastPresenceAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    endReason: { type: String, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PrivateSession', privateSessionSchema);
