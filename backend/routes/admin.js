const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { authorize } = require('../middlewares/roles');
const {
  getUsers,
  getStreams,
  getDepositRequests,
  reviewDepositRequest,
  getWithdrawalRequests,
  reviewWithdrawalRequest,
  // Nuevas funciones
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
} = require('../controllers/adminController');

// Rutas existentes
router.get('/users', auth, authorize('admin'), getUsers);
router.get('/streams', auth, authorize('admin'), getStreams);
router.get('/deposit-requests', auth, authorize('admin'), getDepositRequests);
router.patch('/deposit-requests/:id', auth, authorize('admin'), reviewDepositRequest);
router.get('/withdrawal-requests', auth, authorize('admin'), getWithdrawalRequests);
router.patch('/withdrawal-requests/:id', auth, authorize('admin'), reviewWithdrawalRequest);

// Nuevas rutas de administración
// Reportes
router.get('/reports', auth, authorize('admin'), getReports);
router.patch('/reports/:id', auth, authorize('admin'), reviewReport);

// Estadísticas
router.get('/stats', auth, authorize('admin'), getStats);

// Gestión de roles
router.patch('/users/:id/promote', auth, authorize('admin'), promoteToCreator);
router.patch('/users/:id/demote', auth, authorize('admin'), demoteToUser);

// Baneo de usuarios
router.patch('/users/:id/ban', auth, authorize('admin'), banUser);
router.patch('/users/:id/unban', auth, authorize('admin'), unbanUser);

// Control de streams
router.get('/streams/:id', auth, authorize('admin'), getStreamById);
router.patch('/streams/:id/end', auth, authorize('admin'), endStream);

// Gestión de créditos
router.patch('/users/:id/credits', auth, authorize('admin'), updateUserCredits);

// Transacciones
router.get('/transactions', auth, authorize('admin'), getAllTransactions);

module.exports = router;
