const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'creator', 'admin'], default: 'user' },
    bio: { type: String, trim: true },
    avatar: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    galleryImages: { type: [String], default: [] },
    aboutMe: { type: String, trim: true, default: '' },
    wishlist: { type: String, trim: true, default: '' },
    tipMenu: { type: String, trim: true, default: '' },
    roomRules: { type: String, trim: true, default: '' },
    socials: { type: String, trim: true, default: '' },
    payoutAccountHolder: { type: String, trim: true, default: '' },
    payoutBankName: { type: String, trim: true, default: '' },
    payoutAlias: { type: String, trim: true, default: '' },
    payoutCbu: { type: String, trim: true, default: '' },
    payoutCvu: { type: String, trim: true, default: '' },
    credits: { type: Number, default: 0, min: 0 },
    pendingWithdrawalCredits: { type: Number, default: 0, min: 0 },
    totalCreditsWithdrawn: { type: Number, default: 0, min: 0 },
    totalCreditsEarned: { type: Number, default: 0, min: 0 },
    totalCreditsSpent: { type: Number, default: 0, min: 0 },
    lastDailyCreditAt: { type: Date, default: null },
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    bannedAt: { type: Date, default: null },
    warnings: [{
      note: { type: String },
      date: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
