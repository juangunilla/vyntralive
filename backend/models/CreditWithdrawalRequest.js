const mongoose = require('mongoose');

const creditWithdrawalRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    credits: { type: Number, required: true, min: 1 },
    accountHolder: { type: String, required: true, trim: true },
    bankName: { type: String, trim: true, default: '' },
    alias: { type: String, trim: true, default: '' },
    cbu: { type: String, trim: true, default: '' },
    cvu: { type: String, trim: true, default: '' },
    requesterNote: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: { type: String, trim: true, default: '' },
    paymentReference: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CreditWithdrawalRequest', creditWithdrawalRequestSchema);
