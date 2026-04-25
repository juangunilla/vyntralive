const User = require('../models/User');
const Stream = require('../models/Stream');
const Report = require('../models/Report');
const CreditDepositRequest = require('../models/CreditDepositRequest');
const CreditWithdrawalRequest = require('../models/CreditWithdrawalRequest');
const CreditTransaction = require('../models/CreditTransaction');
const {
  ensureCreditsInitialized,
  serializePublicUser,
  serializeCreditTransaction,
  grantCreditsToUser,
  finalizeCreditsWithdrawal,
  cancelCreditsWithdrawal,
} = require('../services/credits');
const { serializeDepositRequest } = require('../services/creditDeposits');
const { serializeWithdrawalRequest } = require('../services/creditWithdrawals');

const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    await Promise.all(users.map((user) => ensureCreditsInitialized(user)));
    res.json(users.map((user) => serializePublicUser(user)));
  } catch (error) {
    next(error);
  }
};

const getStreams = async (req, res, next) => {
  try {
    const streams = await Stream.find().populate('creator', 'name role');
    res.json(streams);
  } catch (error) {
    next(error);
  }
};

const getDepositRequests = async (req, res, next) => {
  try {
    const requests = await CreditDepositRequest.find()
      .sort({ status: 1, createdAt: -1 })
      .populate('user', 'name email role')
      .populate('reviewedBy', 'name email role');

    res.json(requests.map(serializeDepositRequest));
  } catch (error) {
    next(error);
  }
};

const reviewDepositRequest = async (req, res, next) => {
  try {
    const { action, adminNote = '' } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Acción inválida para revisar la solicitud' });
    }

    const request = await CreditDepositRequest.findById(req.params.id)
      .populate('user', 'name email role');

    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Esta solicitud ya fue revisada' });
    }

    request.status = action === 'approve' ? 'approved' : 'rejected';
    request.adminNote = adminNote.trim();
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;

    let creditResult = null;
    if (action === 'approve') {
      creditResult = await grantCreditsToUser({
        userId: request.user._id,
        amount: request.credits,
        type: 'deposit_approved',
        description: `Compra aprobada por transferencia: ${request.packName}`,
      });
    }

    await request.save();

    const populatedRequest = await CreditDepositRequest.findById(request._id)
      .populate('user', 'name email role')
      .populate('reviewedBy', 'name email role');

    res.json({
      message: action === 'approve'
        ? `Se acreditaron ${request.credits} créditos a ${request.user.name}`
        : 'Solicitud rechazada',
      request: serializeDepositRequest(populatedRequest),
      user: creditResult ? serializePublicUser(creditResult.user) : null,
      transaction: creditResult ? serializeCreditTransaction(creditResult.transaction) : null,
    });
  } catch (error) {
    next(error);
  }
};

const getWithdrawalRequests = async (req, res, next) => {
  try {
    const requests = await CreditWithdrawalRequest.find()
      .sort({ status: 1, createdAt: -1 })
      .populate('user', 'name email role')
      .populate('reviewedBy', 'name email role');

    res.json(requests.map(serializeWithdrawalRequest));
  } catch (error) {
    next(error);
  }
};

const reviewWithdrawalRequest = async (req, res, next) => {
  try {
    const { action, adminNote = '', paymentReference = '' } = req.body;
    if (!['mark_paid', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Acción inválida para revisar el retiro' });
    }

    const request = await CreditWithdrawalRequest.findById(req.params.id)
      .populate('user', 'name email role');

    if (!request) {
      return res.status(404).json({ message: 'Solicitud de retiro no encontrada' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Esta solicitud de retiro ya fue revisada' });
    }

    request.status = action === 'mark_paid' ? 'paid' : 'rejected';
    request.adminNote = adminNote.trim();
    request.paymentReference = paymentReference.trim();
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;

    let resultUser = null;
    let transaction = null;

    if (action === 'mark_paid') {
      const withdrawalResult = await finalizeCreditsWithdrawal({
        userId: request.user._id,
        amount: request.credits,
      });
      resultUser = serializePublicUser(withdrawalResult.user);
    } else {
      const cancelResult = await cancelCreditsWithdrawal({
        userId: request.user._id,
        amount: request.credits,
        description: `Retiro rechazado: ${request.credits} créditos devueltos`,
      });
      resultUser = serializePublicUser(cancelResult.user);
      transaction = serializeCreditTransaction(cancelResult.transaction);
    }

    await request.save();

    const populatedRequest = await CreditWithdrawalRequest.findById(request._id)
      .populate('user', 'name email role')
      .populate('reviewedBy', 'name email role');

    res.json({
      message: action === 'mark_paid'
        ? `Retiro marcado como pagado para ${request.user.name}`
        : 'Retiro rechazado y créditos devueltos',
      request: serializeWithdrawalRequest(populatedRequest),
      user: resultUser,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

// ==================== REPORTES ====================

const getReports = async (req, res, next) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const reports = await Report.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('reporter', 'name email role')
      .populate('reportedUser', 'name email role avatar');

    const total = await Report.countDocuments(filter);

    res.json({ reports, total });
  } catch (error) {
    next(error);
  }
};

const reviewReport = async (req, res, next) => {
  try {
    const { action, adminNote = '' } = req.body;
    if (!['dismiss', 'warn_user', 'ban_user'].includes(action)) {
      return res.status(400).json({ message: 'Acción inválida' });
    }

    const report = await Report.findById(req.params.id)
      .populate('reporter', 'name email')
      .populate('reportedUser', 'name email');

    if (!report) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }

    if (report.status !== 'pending') {
      return res.status(400).json({ message: 'Este reporte ya fue revisado' });
    }

    report.status = 'reviewed';
    report.adminNote = adminNote.trim();
    report.reviewedAt = new Date();
    report.reviewedBy = req.user._id;
    report.actionTaken = action;

    let result = { report };

    // Acciones adicionales según la acción
    if (action === 'ban_user') {
      await User.findByIdAndUpdate(report.reportedUser._id, { isBanned: true });
      result.message = 'Usuario reportado baneado';
    } else if (action === 'warn_user') {
      await User.findByIdAndUpdate(report.reportedUser._id, { 
        $push: { warnings: { note: adminNote, date: new Date() } }
      });
      result.message = 'Usuario reportado advertido';
    } else {
      result.message = 'Reporte descartado';
    }

    await report.save();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ==================== ESTADÍSTICAS ====================

const getStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalCreators,
      totalAdmins,
      totalStreams,
      activeStreams,
      totalDeposits,
      totalWithdrawals,
      pendingDeposits,
      pendingWithdrawals,
      recentTransactions,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'creator' }),
      User.countDocuments({ role: 'admin' }),
      Stream.countDocuments(),
      Stream.countDocuments({ status: 'live' }),
      CreditTransaction.countDocuments({ type: 'deposit_approved' }),
      CreditTransaction.countDocuments({ type: 'withdrawal_completed' }),
      CreditDepositRequest.countDocuments({ status: 'pending' }),
      CreditWithdrawalRequest.countDocuments({ status: 'pending' }),
      CreditTransaction.find().sort({ createdAt: -1 }).limit(20),
    ]);

    // Calcular créditos totales del sistema
    const creditStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalCredits: { $sum: '$credits' },
          totalEarned: { $sum: '$totalCreditsEarned' },
          totalSpent: { $sum: '$totalCreditsSpent' },
          totalWithdrawn: { $sum: '$totalCreditsWithdrawn' },
        },
      },
    ]);

    res.json({
      users: {
        total: totalUsers,
        creators: totalCreators,
        admins: totalAdmins,
      },
      streams: {
        total: totalStreams,
        active: activeStreams,
      },
      transactions: {
        deposits: totalDeposits,
        withdrawals: totalWithdrawals,
      },
      pending: {
        deposits: pendingDeposits,
        withdrawals: pendingWithdrawals,
      },
      credits: creditStats[0] || { totalCredits: 0, totalEarned: 0, totalSpent: 0, totalWithdrawn: 0 },
      recentTransactions: recentTransactions.map(t => ({
        id: t._id,
        type: t.type,
        amount: t.amount,
        userId: t.userId,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// ==================== GESTIÓN DE CREADORES ====================

const promoteToCreator = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'No puedes cambiar el rol de un administrador' });
    }

    user.role = 'creator';
    await user.save();

    res.json({ message: `Usuario ${user.name} promovido a creador`, user: serializePublicUser(user) });
  } catch (error) {
    next(error);
  }
};

const demoteToUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'No puedes cambiar el rol de un administrador' });
    }

    user.role = 'user';
    await user.save();

    res.json({ message: `Usuario ${user.name} degradado a usuario regular`, user: serializePublicUser(user) });
  } catch (error) {
    next(error);
  }
};

// ==================== BANEO DE USUARIOS ====================

const banUser = async (req, res, next) => {
  try {
    const { reason = '' } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'No puedes banear a un administrador' });
    }

    user.isBanned = true;
    user.banReason = reason;
    user.bannedAt = new Date();
    await user.save();

    res.json({ message: `Usuario ${user.name} ha sido baneado`, user: serializePublicUser(user) });
  } catch (error) {
    next(error);
  }
};

const unbanUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    user.isBanned = false;
    user.banReason = null;
    user.bannedAt = null;
    await user.save();

    res.json({ message: `Usuario ${user.name} ha sido desbaneado`, user: serializePublicUser(user) });
  } catch (error) {
    next(error);
  }
};

// ==================== CONTROL DE STREAMS ====================

const getStreamById = async (req, res, next) => {
  try {
    const stream = await Stream.findById(req.params.id)
      .populate('creator', 'name email role avatar');
    
    if (!stream) {
      return res.status(404).json({ message: 'Stream no encontrado' });
    }

    res.json(stream);
  } catch (error) {
    next(error);
  }
};

const endStream = async (req, res, next) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) {
      return res.status(404).json({ message: 'Stream no encontrado' });
    }

    stream.status = 'offline';
    await stream.save();

    res.json({ message: 'Stream terminado', stream });
  } catch (error) {
    next(error);
  }
};

// ==================== CRÉDITOS ====================

const updateUserCredits = async (req, res, next) => {
  try {
    const { credits, action, note = '' } = req.body;
    if (!credits || credits <= 0) {
      return res.status(400).json({ message: 'Cantidad de créditos inválida' });
    }
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ message: 'Acción inválida' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await ensureCreditsInitialized(user);

    let transaction;
    if (action === 'add') {
      const result = await grantCreditsToUser({
        userId: user._id,
        amount: credits,
        type: 'admin_bonus',
        description: note || 'Créditos agregados por administrador',
      });
      transaction = serializeCreditTransaction(result.transaction);
    } else {
      if (user.credits < credits) {
        return res.status(400).json({ message: 'El usuario no tiene suficientes créditos' });
      }
      user.credits -= credits;
      user.totalCreditsSpent += credits;
      await user.save();

      transaction = await CreditTransaction.create({
        userId: user._id,
        type: 'admin_deduction',
        amount: -credits,
        description: note || 'Créditos deducidos por administrador',
      });
    }

    const updatedUser = await User.findById(user._id);
    await ensureCreditsInitialized(updatedUser);

    res.json({
      message: action === 'add' 
        ? `Se agregaron ${credits} créditos a ${user.name}` 
        : `Se removieron ${credits} créditos de ${user.name}`,
      user: serializePublicUser(updatedUser),
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

const getAllTransactions = async (req, res, next) => {
  try {
    const { type, limit = 100, skip = 0 } = req.query;
    const filter = {};
    if (type) filter.type = type;

    const transactions = await CreditTransaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('userId', 'name email');

    const total = await CreditTransaction.countDocuments(filter);

    res.json({
      transactions: transactions.map(t => ({
        id: t._id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        user: t.userId ? { id: t.userId._id, name: t.userId.name, email: t.userId.email } : null,
        createdAt: t.createdAt,
      })),
      total,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getStreams,
  getDepositRequests,
  reviewDepositRequest,
  getWithdrawalRequests,
  reviewWithdrawalRequest,
  // Nuevas funciones de admin
  getReports,
  reviewReport,
  getStats,
  promoteToCreator,
  demoteToUser,
  banUser,
  unbanUser,
  getStreamById,
  endStream,
  updateUserCredits,
  getAllTransactions,
};
