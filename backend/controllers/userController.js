const User = require('../models/User');
const CreditDepositRequest = require('../models/CreditDepositRequest');
const CreditWithdrawalRequest = require('../models/CreditWithdrawalRequest');
const {
  DAILY_BONUS_CREDITS,
  serializePublicUser,
  serializeCreditTransaction,
  claimDailyCredits,
  getCreditHistory,
  requestCreditsWithdrawal,
  cancelCreditsWithdrawal,
} = require('../services/credits');
const {
  getProfileUploadUrl,
  getDepositProofUrl,
  deleteUploadedFileByUrl,
} = require('../services/uploads');
const {
  getDepositConfig,
  getCreditPackById,
  serializeDepositRequest,
} = require('../services/creditDeposits');
const { serializeWithdrawalRequest } = require('../services/creditWithdrawals');

const MAX_GALLERY_IMAGES = 12;

const normalizeGalleryImages = (value) => (
  Array.isArray(value)
    ? value
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim())
        .slice(0, MAX_GALLERY_IMAGES)
    : []
);

const getProfile = async (req, res, next) => {
  try {
    res.json(serializePublicUser(req.user));
  } catch (error) {
    next(error);
  }
};

const getCreditDepositConfig = async (req, res, next) => {
  try {
    res.json(getDepositConfig());
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      bio,
      avatar,
      coverImage,
      galleryImages,
      aboutMe,
      wishlist,
      tipMenu,
      roomRules,
      socials,
      payoutAccountHolder,
      payoutBankName,
      payoutAlias,
      payoutCbu,
      payoutCvu,
    } = req.body;
    const updatePayload = {
      name,
      bio,
      avatar,
      coverImage,
      aboutMe,
      wishlist,
      tipMenu,
      roomRules,
      socials,
      payoutAccountHolder,
      payoutBankName,
      payoutAlias,
      payoutCbu,
      payoutCvu,
    };

    if (galleryImages !== undefined) {
      updatePayload.galleryImages = normalizeGalleryImages(galleryImages);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updatePayload,
      { new: true, runValidators: true }
    ).select('-password');
    res.json(serializePublicUser(user));
  } catch (error) {
    next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Selecciona una imagen para el avatar' });
    }

    const user = await User.findById(req.user._id).select('-password');
    user.avatar = getProfileUploadUrl(req, req.file.filename);
    await user.save();

    return res.json({
      message: 'Avatar subido correctamente',
      url: user.avatar,
      user: serializePublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const uploadCoverImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Selecciona una imagen para la portada' });
    }

    const user = await User.findById(req.user._id).select('-password');
    user.coverImage = getProfileUploadUrl(req, req.file.filename);
    await user.save();

    return res.json({
      message: 'Portada subida correctamente',
      url: user.coverImage,
      user: serializePublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const uploadGalleryImages = async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ message: 'Selecciona al menos una foto para la galería' });
    }

    const uploadedUrls = req.files.map((file) => getProfileUploadUrl(req, file.filename));
    const user = await User.findById(req.user._id).select('-password');
    user.galleryImages = normalizeGalleryImages([
      ...(user.galleryImages || []),
      ...uploadedUrls,
    ]);
    await user.save();

    return res.json({
      message: 'Fotos subidas correctamente',
      uploadedUrls,
      user: serializePublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const deleteGalleryImage = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'La foto a eliminar es obligatoria' });
    }

    const user = await User.findById(req.user._id).select('-password');
    user.galleryImages = normalizeGalleryImages(
      (user.galleryImages || []).filter((item) => item !== url),
    );
    await user.save();
    await deleteUploadedFileByUrl(url);

    return res.json({
      message: 'Foto eliminada de la galería',
      user: serializePublicUser(user),
    });
  } catch (error) {
    next(error);
  }
};

const getCreditsHistory = async (req, res, next) => {
  try {
    const transactions = await getCreditHistory(req.user._id);
    res.json({
      user: serializePublicUser(req.user),
      dailyBonusAmount: DAILY_BONUS_CREDITS,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

const claimDailyBonus = async (req, res, next) => {
  try {
    const { user, transaction } = await claimDailyCredits(req.user._id);
    res.json({
      message: `Recibiste ${DAILY_BONUS_CREDITS} créditos por tu bonus diario ✨`,
      amountGranted: DAILY_BONUS_CREDITS,
      user: serializePublicUser(user),
      transaction: serializeCreditTransaction(transaction),
    });
  } catch (error) {
    next(error);
  }
};

const getDepositRequests = async (req, res, next) => {
  try {
    const requests = await CreditDepositRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'name email role');

    res.json(requests.map(serializeDepositRequest));
  } catch (error) {
    next(error);
  }
};

const createDepositRequest = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Subí el comprobante de la transferencia' });
    }

    const pack = getCreditPackById(req.body?.packId);
    if (!pack) {
      return res.status(400).json({ message: 'Seleccioná un pack válido de créditos' });
    }

    const payerName = (req.body?.payerName || req.user.name || '').trim();
    if (!payerName) {
      return res.status(400).json({ message: 'Indicá el nombre del titular de la transferencia' });
    }

    const request = await CreditDepositRequest.create({
      user: req.user._id,
      packId: pack.id,
      packName: `${pack.label} · ${pack.credits} créditos`,
      amountArs: pack.amountArs,
      credits: pack.credits,
      payerName,
      transferReference: (req.body?.transferReference || '').trim(),
      proofImage: getDepositProofUrl(req, req.file.filename),
    });

    const populatedRequest = await CreditDepositRequest.findById(request._id)
      .populate('user', 'name email role')
      .populate('reviewedBy', 'name email role');

    res.status(201).json({
      message: 'Solicitud enviada. Un admin la revisará y acreditará tus créditos.',
      request: serializeDepositRequest(populatedRequest),
    });
  } catch (error) {
    next(error);
  }
};

const getWithdrawalRequests = async (req, res, next) => {
  try {
    const requests = await CreditWithdrawalRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'name email role');

    res.json(requests.map(serializeWithdrawalRequest));
  } catch (error) {
    next(error);
  }
};

const createWithdrawalRequest = async (req, res, next) => {
  try {
    if (!['creator', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Solo los creadores pueden pedir retiros' });
    }

    const amount = Number(req.body?.amount);
    const accountHolder = (req.body?.accountHolder || req.user.payoutAccountHolder || req.user.name || '').trim();
    const bankName = (req.body?.bankName || req.user.payoutBankName || '').trim();
    const alias = (req.body?.alias || req.user.payoutAlias || '').trim();
    const cbu = (req.body?.cbu || req.user.payoutCbu || '').trim();
    const cvu = (req.body?.cvu || req.user.payoutCvu || '').trim();
    const requesterNote = (req.body?.requesterNote || '').trim();

    if (!accountHolder) {
      return res.status(400).json({ message: 'Completá el titular de la cuenta para pedir el retiro' });
    }

    if (!alias && !cbu && !cvu) {
      return res.status(400).json({ message: 'Necesitas alias, CBU o CVU para que el admin pueda pagarte' });
    }

    const persistedUser = await User.findById(req.user._id).select('-password');
    if (!persistedUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    persistedUser.payoutAccountHolder = accountHolder;
    persistedUser.payoutBankName = bankName;
    persistedUser.payoutAlias = alias;
    persistedUser.payoutCbu = cbu;
    persistedUser.payoutCvu = cvu;
    await persistedUser.save();

    let withdrawalResult = null;
    let request = null;

    try {
      withdrawalResult = await requestCreditsWithdrawal({
        userId: req.user._id,
        amount,
        description: `Solicitud de retiro de ${amount} créditos`,
      });

      request = await CreditWithdrawalRequest.create({
        user: req.user._id,
        credits: amount,
        accountHolder,
        bankName,
        alias,
        cbu,
        cvu,
        requesterNote,
      });
    } catch (error) {
      if (withdrawalResult?.amount && !request) {
        await cancelCreditsWithdrawal({
          userId: req.user._id,
          amount: withdrawalResult.amount,
          description: `Rollback por error al crear la solicitud de retiro (${withdrawalResult.amount} créditos devueltos)`,
        }).catch(() => null);
      }

      throw error;
    }

    const populatedRequest = await CreditWithdrawalRequest.findById(request._id)
      .populate('user', 'name email role')
      .populate('reviewedBy', 'name email role');

    res.status(201).json({
      message: 'Solicitud de retiro enviada. El admin deberá marcarla como pagada o rechazarla.',
      request: serializeWithdrawalRequest(populatedRequest),
      user: serializePublicUser(withdrawalResult.user),
      transaction: serializeCreditTransaction(withdrawalResult.transaction),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
