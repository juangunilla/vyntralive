const serializeWithdrawalRequest = (request) => ({
  id: request?._id,
  _id: request?._id,
  credits: request?.credits || 0,
  accountHolder: request?.accountHolder || '',
  bankName: request?.bankName || '',
  alias: request?.alias || '',
  cbu: request?.cbu || '',
  cvu: request?.cvu || '',
  requesterNote: request?.requesterNote || '',
  status: request?.status || 'pending',
  adminNote: request?.adminNote || '',
  paymentReference: request?.paymentReference || '',
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
  serializeWithdrawalRequest,
};
