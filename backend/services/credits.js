const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

const STARTING_CREDITS = Math.max(0, Number(process.env.STARTING_CREDITS || 150));
const DAILY_BONUS_CREDITS = Math.max(0, Number(process.env.DAILY_BONUS_CREDITS || 25));
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

const getNumericValue = (value, fallback = 0) => (
  Number.isFinite(value) ? value : fallback
);

const getCreditBalance = (user) => getNumericValue(user?.credits, 0);

const getDailyCreditStatus = (user) => {
  const lastDailyCreditAt = user?.lastDailyCreditAt ? new Date(user.lastDailyCreditAt) : null;
  const nextDailyCreditAt = lastDailyCreditAt
    ? new Date(lastDailyCreditAt.getTime() + DAILY_INTERVAL_MS)
    : null;
  const canClaimDaily = !nextDailyCreditAt || nextDailyCreditAt <= new Date();

  return {
    lastDailyCreditAt,
    nextDailyCreditAt,
    canClaimDaily,
  };
};

const serializePublicUser = (user) => {
  const id = user?._id || user?.id;
  const dailyStatus = getDailyCreditStatus(user);

  return {
    id,
    _id: id,
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'user',
    bio: user?.bio || '',
    avatar: user?.avatar || '',
    coverImage: user?.coverImage || '',
    galleryImages: Array.isArray(user?.galleryImages) ? user.galleryImages : [],
    aboutMe: user?.aboutMe || '',
    wishlist: user?.wishlist || '',
    tipMenu: user?.tipMenu || '',
    roomRules: user?.roomRules || '',
    socials: user?.socials || '',
    payoutAccountHolder: user?.payoutAccountHolder || '',
    payoutBankName: user?.payoutBankName || '',
    payoutAlias: user?.payoutAlias || '',
    payoutCbu: user?.payoutCbu || '',
    payoutCvu: user?.payoutCvu || '',
    credits: getCreditBalance(user),
    pendingWithdrawalCredits: getNumericValue(user?.pendingWithdrawalCredits, 0),
    totalCreditsWithdrawn: getNumericValue(user?.totalCreditsWithdrawn, 0),
    totalCreditsEarned: getNumericValue(user?.totalCreditsEarned, getCreditBalance(user)),
    totalCreditsSpent: getNumericValue(user?.totalCreditsSpent, 0),
    lastDailyCreditAt: dailyStatus.lastDailyCreditAt,
    nextDailyCreditAt: dailyStatus.nextDailyCreditAt,
    canClaimDaily: dailyStatus.canClaimDaily,
  };
};

const serializeCreditTransaction = (transaction) => ({
  id: transaction?._id,
  _id: transaction?._id,
  type: transaction?.type,
  direction: transaction?.direction,
  amount: transaction?.amount || 0,
  balanceAfter: transaction?.balanceAfter || 0,
  description: transaction?.description || '',
  createdAt: transaction?.createdAt || null,
  referenceUser: transaction?.referenceUser
    ? {
        _id: transaction.referenceUser._id,
        name: transaction.referenceUser.name,
        role: transaction.referenceUser.role,
      }
    : null,
  referenceStream: transaction?.referenceStream
    ? {
        _id: transaction.referenceStream._id,
        title: transaction.referenceStream.title,
      }
    : null,
});

const createCreditEntry = async ({
  userId,
  type,
  direction,
  amount,
  balanceAfter,
  description,
  referenceUserId,
  referenceStreamId,
}) => CreditTransaction.create({
  user: userId,
  type,
  direction,
  amount,
  balanceAfter,
  description,
  referenceUser: referenceUserId || undefined,
  referenceStream: referenceStreamId || undefined,
});

const recordWelcomeCredits = async (user) => (
  createCreditEntry({
    userId: user._id,
    type: 'welcome_bonus',
    direction: 'credit',
    amount: STARTING_CREDITS,
    balanceAfter: getCreditBalance(user),
    description: 'Bonus de bienvenida para arrancar la plataforma',
  })
);

const ensureCreditsInitialized = async (user) => {
  if (!user) {
    return user;
  }

  const needsCredits = !Number.isFinite(user.credits);
  let changed = false;

  if (needsCredits) {
    user.credits = STARTING_CREDITS;
    changed = true;
  }

  if (!Number.isFinite(user.totalCreditsEarned)) {
    user.totalCreditsEarned = needsCredits ? STARTING_CREDITS : getCreditBalance(user);
    changed = true;
  }

  if (!Number.isFinite(user.totalCreditsSpent)) {
    user.totalCreditsSpent = 0;
    changed = true;
  }

  if (!Number.isFinite(user.pendingWithdrawalCredits)) {
    user.pendingWithdrawalCredits = 0;
    changed = true;
  }

  if (!Number.isFinite(user.totalCreditsWithdrawn)) {
    user.totalCreditsWithdrawn = 0;
    changed = true;
  }

  if (user.lastDailyCreditAt === undefined) {
    user.lastDailyCreditAt = null;
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  if (needsCredits) {
    const existingWelcomeEntry = await CreditTransaction.findOne({
      user: user._id,
      type: 'welcome_bonus',
    });

    if (!existingWelcomeEntry) {
      await recordWelcomeCredits(user);
    }
  }

  return user;
};

const normalizeCreditAmount = (value) => {
  const amount = Number(value);

  if (!Number.isInteger(amount) || amount <= 0) {
    const error = new Error('El monto de créditos debe ser un entero positivo');
    error.status = 400;
    throw error;
  }

  return amount;
};

const claimDailyCredits = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  await ensureCreditsInitialized(user);

  const dailyStatus = getDailyCreditStatus(user);
  if (!dailyStatus.canClaimDaily) {
    const error = new Error('El bonus diario todavía no está disponible');
    error.status = 400;
    error.nextDailyCreditAt = dailyStatus.nextDailyCreditAt;
    throw error;
  }

  user.credits += DAILY_BONUS_CREDITS;
  user.totalCreditsEarned = getNumericValue(user.totalCreditsEarned, 0) + DAILY_BONUS_CREDITS;
  user.lastDailyCreditAt = new Date();
  await user.save();

  const transaction = await createCreditEntry({
    userId: user._id,
    type: 'daily_bonus',
    direction: 'credit',
    amount: DAILY_BONUS_CREDITS,
    balanceAfter: user.credits,
    description: 'Bonus diario reclamado',
  });

  return { user, transaction };
};

const grantCreditsToUser = async ({
  userId,
  amount,
  description,
  type = 'admin_adjustment',
  referenceUserId,
  referenceStreamId,
}) => {
  const normalizedAmount = normalizeCreditAmount(amount);
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  await ensureCreditsInitialized(user);

  user.credits += normalizedAmount;
  user.totalCreditsEarned = getNumericValue(user.totalCreditsEarned, 0) + normalizedAmount;
  await user.save();

  const transaction = await createCreditEntry({
    userId: user._id,
    type,
    direction: 'credit',
    amount: normalizedAmount,
    balanceAfter: user.credits,
    description,
    referenceUserId,
    referenceStreamId,
  });

  return { user, transaction, amount: normalizedAmount };
};

const requestCreditsWithdrawal = async ({
  userId,
  amount,
  description,
}) => {
  const normalizedAmount = normalizeCreditAmount(amount);
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  await ensureCreditsInitialized(user);

  if (getCreditBalance(user) < normalizedAmount) {
    const error = new Error('No tienes créditos suficientes para pedir ese retiro');
    error.status = 400;
    throw error;
  }

  user.credits -= normalizedAmount;
  user.pendingWithdrawalCredits = getNumericValue(user.pendingWithdrawalCredits, 0) + normalizedAmount;
  await user.save();

  const transaction = await createCreditEntry({
    userId: user._id,
    type: 'withdrawal_request',
    direction: 'debit',
    amount: normalizedAmount,
    balanceAfter: user.credits,
    description,
  });

  return { user, transaction, amount: normalizedAmount };
};

const finalizeCreditsWithdrawal = async ({ userId, amount }) => {
  const normalizedAmount = normalizeCreditAmount(amount);
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  await ensureCreditsInitialized(user);

  if (getNumericValue(user.pendingWithdrawalCredits, 0) < normalizedAmount) {
    const error = new Error('El usuario no tiene ese retiro reservado');
    error.status = 400;
    throw error;
  }

  user.pendingWithdrawalCredits -= normalizedAmount;
  user.totalCreditsWithdrawn = getNumericValue(user.totalCreditsWithdrawn, 0) + normalizedAmount;
  await user.save();

  return { user, amount: normalizedAmount };
};

const cancelCreditsWithdrawal = async ({
  userId,
  amount,
  description,
}) => {
  const normalizedAmount = normalizeCreditAmount(amount);
  const user = await User.findById(userId);

  if (!user) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  await ensureCreditsInitialized(user);

  if (getNumericValue(user.pendingWithdrawalCredits, 0) < normalizedAmount) {
    const error = new Error('El usuario no tiene ese retiro reservado');
    error.status = 400;
    throw error;
  }

  user.pendingWithdrawalCredits -= normalizedAmount;
  user.credits += normalizedAmount;
  await user.save();

  const transaction = await createCreditEntry({
    userId: user._id,
    type: 'withdrawal_rejected_refund',
    direction: 'credit',
    amount: normalizedAmount,
    balanceAfter: user.credits,
    description,
  });

  return { user, transaction, amount: normalizedAmount };
};

const transferCredits = async ({
  senderId,
  receiverId,
  amount,
  referenceStreamId,
  senderDescription,
  receiverDescription,
}) => {
  const normalizedAmount = normalizeCreditAmount(amount);

  if (senderId.toString() === receiverId.toString()) {
    const error = new Error('No puedes enviarte créditos a ti mismo');
    error.status = 400;
    throw error;
  }

  const [sender, receiver] = await Promise.all([
    User.findById(senderId),
    User.findById(receiverId),
  ]);

  if (!sender || !receiver) {
    const error = new Error('No se pudo encontrar uno de los usuarios involucrados');
    error.status = 404;
    throw error;
  }

  await Promise.all([
    ensureCreditsInitialized(sender),
    ensureCreditsInitialized(receiver),
  ]);

  if (getCreditBalance(sender) < normalizedAmount) {
    const error = new Error('No tienes créditos suficientes para enviar esa propina');
    error.status = 400;
    throw error;
  }

  sender.credits -= normalizedAmount;
  sender.totalCreditsSpent = getNumericValue(sender.totalCreditsSpent, 0) + normalizedAmount;

  receiver.credits += normalizedAmount;
  receiver.totalCreditsEarned = getNumericValue(receiver.totalCreditsEarned, 0) + normalizedAmount;

  await sender.save();
  await receiver.save();

  const [senderTransaction, receiverTransaction] = await Promise.all([
    createCreditEntry({
      userId: sender._id,
      type: 'tip_sent',
      direction: 'debit',
      amount: normalizedAmount,
      balanceAfter: sender.credits,
      description: senderDescription,
      referenceUserId: receiver._id,
      referenceStreamId,
    }),
    createCreditEntry({
      userId: receiver._id,
      type: 'tip_received',
      direction: 'credit',
      amount: normalizedAmount,
      balanceAfter: receiver.credits,
      description: receiverDescription,
      referenceUserId: sender._id,
      referenceStreamId,
    }),
  ]);

  return {
    amount: normalizedAmount,
    sender,
    receiver,
    senderTransaction,
    receiverTransaction,
  };
};

const getCreditHistory = async (userId, limit = 12) => {
  const transactions = await CreditTransaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('referenceUser', 'name role')
    .populate('referenceStream', 'title');

  return transactions.map(serializeCreditTransaction);
};

module.exports = {
  STARTING_CREDITS,
  DAILY_BONUS_CREDITS,
  ensureCreditsInitialized,
  serializePublicUser,
  serializeCreditTransaction,
  recordWelcomeCredits,
  claimDailyCredits,
  grantCreditsToUser,
  requestCreditsWithdrawal,
  finalizeCreditsWithdrawal,
  cancelCreditsWithdrawal,
  transferCredits,
  getCreditHistory,
};
