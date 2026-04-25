const CREDIT_PACKS = [
  {
    id: 'starter_100',
    label: 'Starter',
    credits: 100,
    amountArs: 2500,
    bonusLabel: 'Ideal para probar tips y support.',
  },
  {
    id: 'boost_250',
    label: 'Boost',
    credits: 250,
    amountArs: 5800,
    bonusLabel: 'Mejor relación precio/créditos.',
  },
  {
    id: 'power_700',
    label: 'Power',
    credits: 700,
    amountArs: 14900,
    bonusLabel: 'Pensado para usuarios muy activos.',
  },
];

const serializeCreditPack = (pack) => ({
  id: pack.id,
  label: pack.label,
  credits: pack.credits,
  amountArs: pack.amountArs,
  bonusLabel: pack.bonusLabel,
});

const getCreditPackById = (packId) => CREDIT_PACKS.find((pack) => pack.id === packId) || null;

const getDepositConfig = () => ({
  bankOwner: process.env.BANK_TRANSFER_OWNER || 'Configurar titular',
  bankName: process.env.BANK_TRANSFER_BANK || 'Configurar banco',
  alias: process.env.BANK_TRANSFER_ALIAS || 'CONFIGURAR.ALIAS',
  cbu: process.env.BANK_TRANSFER_CBU || '',
  cvu: process.env.BANK_TRANSFER_CVU || '',
  note: process.env.BANK_TRANSFER_NOTE || 'Transferí, subí el comprobante y el admin acredita tus créditos.',
  packs: CREDIT_PACKS.map(serializeCreditPack),
});

const serializeDepositRequest = (request) => ({
  id: request?._id,
  _id: request?._id,
  packId: request?.packId || '',
  packName: request?.packName || '',
  amountArs: request?.amountArs || 0,
  credits: request?.credits || 0,
  payerName: request?.payerName || '',
  transferReference: request?.transferReference || '',
  proofImage: request?.proofImage || '',
  status: request?.status || 'pending',
  adminNote: request?.adminNote || '',
  createdAt: request?.createdAt || null,
  updatedAt: request?.updatedAt || null,
  reviewedAt: request?.reviewedAt || null,
  user: request?.user
    ? {
        _id: request.user._id,
        name: request.user.name,
        email: request.user.email,
        role: request.user.role,
      }
    : null,
  reviewedBy: request?.reviewedBy
    ? {
        _id: request.reviewedBy._id,
        name: request.reviewedBy.name,
        email: request.reviewedBy.email,
        role: request.reviewedBy.role,
      }
    : null,
});

module.exports = {
  CREDIT_PACKS,
  getCreditPackById,
  getDepositConfig,
  serializeCreditPack,
  serializeDepositRequest,
};
