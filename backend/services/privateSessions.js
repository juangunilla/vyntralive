const PrivateSession = require('../models/PrivateSession');
const Stream = require('../models/Stream');
const {
  createLiveSession,
  ensurePrivateRoom,
  deleteRoom,
  listRoomParticipants,
} = require('./livekit');
const {
  serializePublicUser,
  reservePrivateSessionCredits,
  settlePrivateSessionCredits,
  refundPrivateSessionCredits,
} = require('./credits');

const PRIVATE_SESSION_RATE_PER_MINUTE = Math.max(1, Number(process.env.PRIVATE_SESSION_RATE_PER_MINUTE || 12));
const PRIVATE_SESSION_MIN_MINUTES = Math.max(1, Number(process.env.PRIVATE_SESSION_MIN_MINUTES || 5));
const PRIVATE_SESSION_REQUEST_EXPIRY_MINUTES = Math.max(5, Number(process.env.PRIVATE_SESSION_REQUEST_EXPIRY_MINUTES || 15));
const PRIVATE_SESSION_RECONNECT_GRACE_MINUTES = Math.max(1, Number(process.env.PRIVATE_SESSION_RECONNECT_GRACE_MINUTES || 2));
const PRIVATE_SESSION_SWEEP_INTERVAL_MS = Math.max(10000, Number(process.env.PRIVATE_SESSION_SWEEP_INTERVAL_MS || 15000));

const getPrivateSessionConfig = () => ({
  ratePerMinute: PRIVATE_SESSION_RATE_PER_MINUTE,
  minMinutes: PRIVATE_SESSION_MIN_MINUTES,
  requestExpiryMinutes: PRIVATE_SESSION_REQUEST_EXPIRY_MINUTES,
  reconnectGraceMinutes: PRIVATE_SESSION_RECONNECT_GRACE_MINUTES,
  sweepIntervalMs: PRIVATE_SESSION_SWEEP_INTERVAL_MS,
  maxParticipants: 2,
});

const toObjectIdString = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id?.toString?.() || value.id?.toString?.() || value.toString?.() || '';
};

const serializeStream = (stream) => {
  if (!stream) return null;

  return {
    _id: stream._id,
    id: stream._id,
    title: stream.title,
    status: stream.status,
    roomName: stream.roomName,
    creator: stream.creator
      ? {
          _id: stream.creator._id || stream.creator,
          id: stream.creator._id || stream.creator,
          name: stream.creator.name || '',
          role: stream.creator.role || '',
          avatar: stream.creator.avatar || '',
        }
      : null,
  };
};

const serializePrivateSession = (session) => {
  if (!session) return null;

  return {
    id: session._id,
    _id: session._id,
    stream: serializeStream(session.stream),
    creator: session.creator ? serializePublicUser(session.creator) : null,
    viewer: session.viewer ? serializePublicUser(session.viewer) : null,
    roomName: session.roomName,
    status: session.status,
    requestedMinutes: session.requestedMinutes,
    ratePerMinute: session.ratePerMinute,
    totalCredits: session.totalCredits,
    reservedCredits: session.reservedCredits,
    billedMinutes: session.billedMinutes,
    billedCredits: session.billedCredits,
    confirmedAt: session.confirmedAt,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    expiresAt: session.expiresAt,
    lastBilledAt: session.lastBilledAt,
    lastPresenceAt: session.lastPresenceAt,
    rejectionReason: session.rejectionReason || '',
    endReason: session.endReason || '',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
};

const populatePrivateSession = async (query) => query
  .populate('stream', 'title status roomName creator')
  .populate('creator', 'name email role bio avatar coverImage aboutMe wishlist tipMenu roomRules socials credits pendingPrivateSessionCredits')
  .populate('viewer', 'name email role bio avatar coverImage aboutMe wishlist tipMenu roomRules socials credits pendingPrivateSessionCredits');

const loadPrivateSession = async (sessionId) => populatePrivateSession(
  PrivateSession.findById(sessionId),
);

const loadPrivateSessionByRoom = async (roomName) => populatePrivateSession(
  PrivateSession.findOne({ roomName }),
);

const isUserSessionParticipant = (session, userId) => {
  const actorId = toObjectIdString(userId);
  if (!actorId || !session) return false;

  return actorId === toObjectIdString(session.creator) || actorId === toObjectIdString(session.viewer);
};

const assertSessionAccess = (session, user) => {
  if (!session) {
    const error = new Error('Sesión privada no encontrada');
    error.status = 404;
    throw error;
  }

  const userId = toObjectIdString(user);
  if (!userId) {
    const error = new Error('Usuario no autenticado');
    error.status = 401;
    throw error;
  }

  if (user?.role === 'admin') {
    return;
  }

  if (!isUserSessionParticipant(session, userId)) {
    const error = new Error('No tienes acceso a este privado');
    error.status = 403;
    throw error;
  }
};

const assertCreatorAccess = (session, user) => {
  if (!session) {
    const error = new Error('Sesión privada no encontrada');
    error.status = 404;
    throw error;
  }

  if (!user) {
    const error = new Error('Usuario no autenticado');
    error.status = 401;
    throw error;
  }

  if (user.role === 'admin') {
    return;
  }

  if (toObjectIdString(session.creator) !== toObjectIdString(user)) {
    const error = new Error('Solo el creador de la room puede aprobar este privado');
    error.status = 403;
    throw error;
  }
};

const getSessionRoomMetadata = (session) => JSON.stringify({
  kind: 'private_session',
  sessionId: toObjectIdString(session._id),
  streamId: toObjectIdString(session.stream),
  creatorId: toObjectIdString(session.creator),
  viewerId: toObjectIdString(session.viewer),
  status: session.status,
  requestedMinutes: session.requestedMinutes,
  ratePerMinute: session.ratePerMinute,
});

const safeDeleteRoom = async (roomName) => {
  try {
    await deleteRoom(roomName);
  } catch (error) {
    console.error('Error deleting private room:', error.message);
  }
};

const closePrivateSession = async (session, {
  status = 'ended',
  endReason = 'Sesión privada finalizada',
  refundRemaining = true,
} = {}) => {
  const freshSession = await PrivateSession.findById(session._id);

  if (!freshSession) {
    return null;
  }

  if (['ended', 'rejected', 'cancelled', 'expired'].includes(freshSession.status)) {
    return loadPrivateSession(freshSession._id);
  }

  const remainingCredits = Math.max(0, Number(freshSession.reservedCredits || 0));

  if (refundRemaining && remainingCredits > 0) {
    await refundPrivateSessionCredits({
      userId: freshSession.viewer,
      amount: remainingCredits,
      description: `${endReason}. Se devolvieron los créditos no usados del privado.`,
      referenceUserId: freshSession.creator,
      referenceStreamId: freshSession.stream,
    });
  }

  freshSession.status = status;
  freshSession.endReason = endReason;
  freshSession.endedAt = new Date();
  freshSession.reservedCredits = 0;
  freshSession.lastBilledAt = freshSession.lastBilledAt || freshSession.startedAt || null;
  freshSession.lastPresenceAt = freshSession.lastPresenceAt || freshSession.startedAt || null;
  await freshSession.save();

  await safeDeleteRoom(freshSession.roomName);

  return loadPrivateSession(freshSession._id);
};

const refreshPendingSessionIfNeeded = async (session) => {
  if (!session) return null;

  const now = new Date();
  if (['pending', 'confirmed'].includes(session.status) && session.expiresAt && new Date(session.expiresAt) <= now) {
    return closePrivateSession(session, {
      status: 'expired',
      endReason: 'La reserva privada expiró antes de comenzar',
      refundRemaining: true,
    });
  }

  return session;
};

const syncActivePrivateSession = async (session) => {
  const freshSession = await PrivateSession.findById(session._id);
  if (!freshSession) return null;

  if (['ended', 'rejected', 'cancelled', 'expired'].includes(freshSession.status)) {
    return loadPrivateSession(freshSession._id);
  }

  const now = new Date();
  const participants = await listRoomParticipants(freshSession.roomName).catch((error) => {
    console.error('Error listing private room participants:', error.message);
    return [];
  });
  const participantIdentities = new Set(participants.map((participant) => toObjectIdString(participant.identity)));
  const creatorId = toObjectIdString(freshSession.creator);
  const viewerId = toObjectIdString(freshSession.viewer);
  const creatorPresent = participantIdentities.has(creatorId);
  const viewerPresent = participantIdentities.has(viewerId);
  const bothPresent = creatorPresent && viewerPresent;
  const connectedForTooLong = freshSession.lastPresenceAt
    ? (now.getTime() - new Date(freshSession.lastPresenceAt).getTime()) > (PRIVATE_SESSION_RECONNECT_GRACE_MINUTES * 60 * 1000)
    : false;

  if (freshSession.status === 'confirmed' && bothPresent) {
    freshSession.status = 'active';
    freshSession.startedAt = freshSession.startedAt || now;
    freshSession.lastBilledAt = freshSession.lastBilledAt || freshSession.startedAt || now;
    freshSession.lastPresenceAt = now;
    freshSession.expiresAt = new Date((freshSession.startedAt || now).getTime() + (freshSession.requestedMinutes * 60 * 1000));
    await freshSession.save();
  }

  if (freshSession.status !== 'active') {
    return loadPrivateSession(freshSession._id);
  }

  if (bothPresent) {
    freshSession.lastPresenceAt = now;
    if (!freshSession.startedAt) {
      freshSession.startedAt = now;
      freshSession.lastBilledAt = now;
      freshSession.expiresAt = new Date(now.getTime() + (freshSession.requestedMinutes * 60 * 1000));
    }

    if (!freshSession.lastBilledAt) {
      freshSession.lastBilledAt = now;
    }

    const elapsedMinutes = Math.floor((now.getTime() - new Date(freshSession.lastBilledAt).getTime()) / 60000);
    const remainingMinutes = Math.max(0, Number(freshSession.requestedMinutes || 0) - Number(freshSession.billedMinutes || 0));
    const billableMinutes = Math.min(elapsedMinutes, remainingMinutes);

    if (billableMinutes > 0) {
      const billedCredits = billableMinutes * freshSession.ratePerMinute;
      await settlePrivateSessionCredits({
        viewerId: freshSession.viewer,
        creatorId: freshSession.creator,
        amount: billedCredits,
        description: `Privado de ${billableMinutes} minuto(s) con ${freshSession.creator?.name || 'la creadora'}`,
        referenceStreamId: freshSession.stream,
      });

      freshSession.billedMinutes += billableMinutes;
      freshSession.billedCredits += billedCredits;
      freshSession.reservedCredits = Math.max(0, freshSession.reservedCredits - billedCredits);
      freshSession.lastBilledAt = new Date(new Date(freshSession.lastBilledAt).getTime() + (billableMinutes * 60 * 1000));
    }

    await freshSession.save();

    if (freshSession.billedMinutes >= freshSession.requestedMinutes || freshSession.reservedCredits <= 0) {
      return closePrivateSession(freshSession, {
        status: 'ended',
        endReason: 'La videollamada privada alcanzó el tiempo reservado',
        refundRemaining: true,
      });
    }

    return loadPrivateSession(freshSession._id);
  }

  freshSession.lastBilledAt = now;

  if (connectedForTooLong) {
    await freshSession.save();
    return closePrivateSession(freshSession, {
      status: 'ended',
      endReason: 'La videollamada privada se cerró por desconexión',
      refundRemaining: true,
    });
  }

  await freshSession.save();
  return loadPrivateSession(freshSession._id);
};

const refreshPrivateSession = async (sessionOrId) => {
  const session = typeof sessionOrId === 'string'
    ? await loadPrivateSession(sessionOrId)
    : await populatePrivateSession(PrivateSession.findById(sessionOrId._id || sessionOrId));

  if (!session) {
    return null;
  }

  const refreshedPending = await refreshPendingSessionIfNeeded(session);
  if (!refreshedPending) {
    return null;
  }

  if (['active', 'confirmed'].includes(refreshedPending.status)) {
    return syncActivePrivateSession(refreshedPending);
  }

  return loadPrivateSession(refreshedPending._id);
};

const requestPrivateSession = async ({
  streamId,
  viewerId,
  requestedMinutes,
}) => {
  const stream = await Stream.findById(streamId).populate('creator', 'name role avatar bio aboutMe wishlist tipMenu roomRules socials credits pendingPrivateSessionCredits');

  if (!stream) {
    const error = new Error('Transmisión no encontrada');
    error.status = 404;
    throw error;
  }

  if (stream.status !== 'live') {
    const error = new Error('La room ya no está en vivo');
    error.status = 400;
    throw error;
  }

  if (toObjectIdString(stream.creator) === toObjectIdString(viewerId)) {
    const error = new Error('El creador no puede reservar un privado sobre su propia room');
    error.status = 400;
    throw error;
  }

  const config = getPrivateSessionConfig();
  const minutes = Math.ceil(Number(requestedMinutes || config.minMinutes));

  if (!Number.isInteger(minutes) || minutes < config.minMinutes) {
    const error = new Error(`El privado requiere al menos ${config.minMinutes} minutos`);
    error.status = 400;
    throw error;
  }

  const existingSession = await PrivateSession.findOne({
    stream: stream._id,
    status: { $in: ['pending', 'confirmed', 'active'] },
  });

  if (existingSession) {
    const refreshedExisting = await refreshPrivateSession(existingSession);
    if (refreshedExisting && ['pending', 'confirmed', 'active'].includes(refreshedExisting.status)) {
      const error = new Error('Ya existe un privado reservado o en curso en esta room');
      error.status = 409;
      throw error;
    }
  }

  const totalCredits = minutes * config.ratePerMinute;
  const reservation = await reservePrivateSessionCredits({
    userId: viewerId,
    amount: totalCredits,
    description: `Reserva de privado por ${minutes} minuto(s) a ${config.ratePerMinute} fichas por minuto`,
    referenceUserId: stream.creator,
    referenceStreamId: stream._id,
  });

  const roomName = `private-${stream._id.toString()}-${viewerId.toString()}-${Date.now()}`;
  const expiresAt = new Date(Date.now() + (config.requestExpiryMinutes * 60 * 1000));

  let session = null;
  try {
    session = await PrivateSession.create({
      stream: stream._id,
      creator: stream.creator._id || stream.creator,
      viewer: viewerId,
      roomName,
      status: 'pending',
      requestedMinutes: minutes,
      ratePerMinute: config.ratePerMinute,
      totalCredits,
      reservedCredits: totalCredits,
      billedMinutes: 0,
      billedCredits: 0,
      confirmedAt: null,
      startedAt: null,
      endedAt: null,
      expiresAt,
      lastBilledAt: null,
      lastPresenceAt: null,
      rejectionReason: '',
      endReason: '',
    });
  } catch (error) {
    await refundPrivateSessionCredits({
      userId: viewerId,
      amount: totalCredits,
      description: 'Se devolvieron los créditos porque no se pudo crear la reserva privada',
      referenceUserId: stream.creator,
      referenceStreamId: stream._id,
    });
    throw error;
  }

  const populatedSession = await loadPrivateSession(session._id);

  return {
    session: populatedSession,
    user: reservation.user,
    totalCredits,
  };
};

const confirmPrivateSession = async ({ sessionId, actorId }) => {
  const session = await loadPrivateSession(sessionId);
  assertCreatorAccess(session, actorId);

  const refreshedSession = await refreshPendingSessionIfNeeded(session);
  if (!refreshedSession || ['ended', 'rejected', 'cancelled', 'expired'].includes(refreshedSession.status)) {
    const error = new Error('La reserva privada ya no está disponible');
    error.status = 409;
    throw error;
  }

  if (refreshedSession.status === 'confirmed' || refreshedSession.status === 'active') {
    return {
      session: refreshedSession,
      room: null,
    };
  }

  const conflictingSession = await PrivateSession.findOne({
    stream: refreshedSession.stream._id || refreshedSession.stream,
    _id: { $ne: refreshedSession._id },
    status: { $in: ['confirmed', 'active'] },
  });

  if (conflictingSession) {
    const error = new Error('Ya hay otro privado confirmado o en curso en esta room');
    error.status = 409;
    throw error;
  }

  const metadata = getSessionRoomMetadata(refreshedSession);
  const room = await ensurePrivateRoom({
    roomName: refreshedSession.roomName,
    metadata,
  });

  refreshedSession.status = 'confirmed';
  refreshedSession.confirmedAt = new Date();
  refreshedSession.expiresAt = new Date(Date.now() + (PRIVATE_SESSION_REQUEST_EXPIRY_MINUTES * 60 * 1000));
  refreshedSession.rejectionReason = '';
  refreshedSession.endReason = '';
  await refreshedSession.save();

  return {
    session: await loadPrivateSession(refreshedSession._id),
    room,
  };
};

const rejectPrivateSession = async ({ sessionId, actorId, reason = 'La reserva privada fue rechazada por el creador' }) => {
  const session = await loadPrivateSession(sessionId);
  assertCreatorAccess(session, actorId);

  if (['ended', 'rejected', 'cancelled', 'expired'].includes(session.status)) {
    return loadPrivateSession(session._id);
  }

  const updatedSession = await closePrivateSession(session, {
    status: 'rejected',
    endReason: reason,
    refundRemaining: true,
  });

  if (updatedSession) {
    const rejectionDoc = await PrivateSession.findById(updatedSession._id);
    if (rejectionDoc) {
      rejectionDoc.rejectionReason = reason;
      await rejectionDoc.save();
    }
  }

  return loadPrivateSession(session._id);
};

const cancelPrivateSession = async ({ sessionId, actorId, reason = 'El usuario canceló la reserva privada' }) => {
  const session = await loadPrivateSession(sessionId);
  assertSessionAccess(session, actorId);

  if (session.status === 'active') {
    const error = new Error('No puedes cancelar un privado que ya está en curso');
    error.status = 400;
    throw error;
  }

  const cancelled = await closePrivateSession(session, {
    status: 'cancelled',
    endReason: reason,
    refundRemaining: true,
  });

  if (cancelled) {
    const cancellationDoc = await PrivateSession.findById(cancelled._id);
    if (cancellationDoc) {
      cancellationDoc.rejectionReason = reason;
      await cancellationDoc.save();
    }
  }

  return loadPrivateSession(session._id);
};

const endPrivateSession = async ({ sessionId, actorId, reason = 'La videollamada privada terminó' }) => {
  const session = await loadPrivateSession(sessionId);
  assertSessionAccess(session, actorId);

  if (['ended', 'rejected', 'cancelled', 'expired'].includes(session.status)) {
    return loadPrivateSession(session._id);
  }

  const ended = await closePrivateSession(session, {
    status: 'ended',
    endReason: reason,
    refundRemaining: true,
  });

  return loadPrivateSession(ended?._id || session._id);
};

const getPrivateSessionById = async (sessionId, user) => {
  const session = await refreshPrivateSession(sessionId);
  assertSessionAccess(session, user);
  return session;
};

const listPrivateSessionsForStream = async ({ streamId, user }) => {
  const stream = await Stream.findById(streamId).populate('creator', 'name role avatar bio aboutMe wishlist tipMenu roomRules socials credits pendingPrivateSessionCredits');

  if (!stream) {
    const error = new Error('Transmisión no encontrada');
    error.status = 404;
    throw error;
  }

  const isCreator = toObjectIdString(stream.creator) === toObjectIdString(user);
  const filter = {
    stream: stream._id,
  };

  if (!isCreator && user?.role !== 'admin') {
    filter.viewer = user._id;
  }

  const sessions = await PrivateSession.find(filter)
    .sort({ createdAt: -1 })
    .populate('stream', 'title status roomName creator')
    .populate('creator', 'name email role bio avatar coverImage aboutMe wishlist tipMenu roomRules socials credits pendingPrivateSessionCredits')
    .populate('viewer', 'name email role bio avatar coverImage aboutMe wishlist tipMenu roomRules socials credits pendingPrivateSessionCredits');

  return {
    stream: serializeStream(stream),
    sessions: sessions.map(serializePrivateSession),
  };
};

const joinPrivateSession = async ({ sessionId, user }) => {
  const session = await refreshPrivateSession(sessionId);
  assertSessionAccess(session, user);

  if (!session) {
    const error = new Error('Sesión privada no encontrada');
    error.status = 404;
    throw error;
  }

  if (session.status === 'pending') {
    const error = new Error('La reserva todavía no fue confirmada');
    error.status = 409;
    throw error;
  }

  if (['rejected', 'cancelled', 'expired', 'ended'].includes(session.status)) {
    const error = new Error('La reserva privada ya no está disponible');
    error.status = 410;
    throw error;
  }

  const room = await ensurePrivateRoom({
    roomName: session.roomName,
    metadata: getSessionRoomMetadata(session),
  });

  const liveSession = await createLiveSession({
    roomName: session.roomName,
    userId: user._id,
    displayName: user.name,
    canPublish: true,
    canPublishData: true,
  });

  return {
    room,
    session,
    token: liveSession.token,
    url: liveSession.url,
    canPublish: true,
  };
};

const sweepPrivateSessions = async () => {
  const sessions = await PrivateSession.find({
    status: { $in: ['pending', 'confirmed', 'active'] },
  });

  let handled = 0;
  for (const session of sessions) {
    try {
      const refreshed = await refreshPrivateSession(session);
      if (refreshed) {
        handled += 1;
      }
    } catch (error) {
      console.error('Private session sweep error:', error.message);
    }
  }

  return handled;
};

const startPrivateSessionSweep = ({ io } = {}) => {
  void io;

  const interval = setInterval(() => {
    sweepPrivateSessions().catch((error) => {
      console.error('Error sweeping private sessions:', error.message);
    });
  }, PRIVATE_SESSION_SWEEP_INTERVAL_MS);

  return interval;
};

module.exports = {
  getPrivateSessionConfig,
  getPrivateSessionById,
  listPrivateSessionsForStream,
  requestPrivateSession,
  confirmPrivateSession,
  rejectPrivateSession,
  cancelPrivateSession,
  endPrivateSession,
  joinPrivateSession,
  refreshPrivateSession,
  sweepPrivateSessions,
  startPrivateSessionSweep,
  serializePrivateSession,
};
