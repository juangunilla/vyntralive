const mongoose = require('mongoose');

const creditDepositRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    packId: { type: String, required: true, trim: true },
    packName: { type: String, required: true, trim: true },
    amountArs: { type: Number, required: true, min: 1 },
    credits: { type: Number, required: true, min: 1 },
    payerName: { type: String, required: true, trim: true },
    transferReference: { type: String, trim: true, default: '' },
    proofImage: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CreditDepositRequest', creditDepositRequestSchema);
