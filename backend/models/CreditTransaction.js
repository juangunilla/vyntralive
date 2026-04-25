const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'welcome_bonus',
        'daily_bonus',
        'tip_sent',
        'tip_received',
        'admin_adjustment',
        'deposit_approved',
        'withdrawal_request',
        'withdrawal_rejected_refund',
      ],
      required: true,
    },
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true, min: 1 },
    balanceAfter: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    referenceUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referenceStream: { type: mongoose.Schema.Types.ObjectId, ref: 'Stream' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
