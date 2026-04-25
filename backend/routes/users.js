const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { uploadProfileImage, uploadDepositProof } = require('../services/uploads');
const {
  getProfile,
  getCreditDepositConfig,
  updateProfile,
  uploadAvatar,
  uploadCoverImage,
  uploadGalleryImages,
  deleteGalleryImage,
  getDepositRequests,
  createDepositRequest,
  getWithdrawalRequests,
  createWithdrawalRequest,
  getCreditsHistory,
  claimDailyBonus,
} = require('../controllers/userController');

router.get('/profile', auth, getProfile);
router.get('/credits/config', auth, getCreditDepositConfig);
router.put('/profile', auth, updateProfile);
router.post('/uploads/avatar', auth, uploadProfileImage.single('image'), uploadAvatar);
router.post('/uploads/cover', auth, uploadProfileImage.single('image'), uploadCoverImage);
router.post('/uploads/gallery', auth, uploadProfileImage.array('images', 8), uploadGalleryImages);
router.delete('/uploads/gallery', auth, deleteGalleryImage);
router.get('/deposits', auth, getDepositRequests);
router.post('/deposits', auth, uploadDepositProof.single('proof'), createDepositRequest);
router.get('/withdrawals', auth, getWithdrawalRequests);
router.post('/withdrawals', auth, createWithdrawalRequest);
router.get('/credits/history', auth, getCreditsHistory);
router.post('/credits/claim-daily', auth, claimDailyBonus);

module.exports = router;
