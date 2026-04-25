const {
  getPrivateSessionConfig,
  getPrivateSessionById,
  listPrivateSessionsForStream,
  requestPrivateSession,
  confirmPrivateSession,
  rejectPrivateSession,
  cancelPrivateSession,
  endPrivateSession,
  joinPrivateSession,
  serializePrivateSession,
} = require('../services/privateSessions');
const { serializePublicUser } = require('../services/credits');

const getPrivateSessionConfigHandler = async (req, res, next) => {
  try {
    res.json(getPrivateSessionConfig());
  } catch (error) {
    next(error);
  }
};

const getStreamPrivateSessions = async (req, res, next) => {
  try {
    const result = await listPrivateSessionsForStream({
      streamId: req.params.streamId,
      user: req.user,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const requestSession = async (req, res, next) => {
  try {
    const result = await requestPrivateSession({
      streamId: req.params.streamId,
      viewerId: req.user._id,
      requestedMinutes: req.body?.requestedMinutes ?? req.body?.minutes,
    });

    res.status(201).json({
      message: 'Tu privado fue reservado y quedó a la espera de confirmación.',
      session: serializePrivateSession(result.session),
      user: serializePublicUser(result.user),
      totalCredits: result.totalCredits,
    });
  } catch (error) {
    next(error);
  }
};

const getPrivateSession = async (req, res, next) => {
  try {
    const session = await getPrivateSessionById(req.params.id, req.user);
    res.json(serializePrivateSession(session));
  } catch (error) {
    next(error);
  }
};

const confirmSession = async (req, res, next) => {
  try {
    const result = await confirmPrivateSession({
      sessionId: req.params.id,
      actorId: req.user,
    });

    res.json({
      message: 'Privado confirmado por el backend.',
      session: serializePrivateSession(result.session),
      room: result.room ? { name: result.room.name, metadata: result.room.metadata } : null,
    });
  } catch (error) {
    next(error);
  }
};

const rejectSession = async (req, res, next) => {
  try {
    const session = await rejectPrivateSession({
      sessionId: req.params.id,
      actorId: req.user,
      reason: req.body?.reason || 'La reserva privada fue rechazada por el creador',
    });

    res.json({
      message: 'Privado rechazado y créditos reembolsados.',
      session: serializePrivateSession(session),
    });
  } catch (error) {
    next(error);
  }
};

const cancelSession = async (req, res, next) => {
  try {
    const session = await cancelPrivateSession({
      sessionId: req.params.id,
      actorId: req.user,
      reason: req.body?.reason || 'El usuario canceló la reserva privada',
    });

    res.json({
      message: 'Privado cancelado y créditos reembolsados.',
      session: serializePrivateSession(session),
    });
  } catch (error) {
    next(error);
  }
};

const endSession = async (req, res, next) => {
  try {
    const session = await endPrivateSession({
      sessionId: req.params.id,
      actorId: req.user,
      reason: req.body?.reason || 'La videollamada privada terminó',
    });

    res.json({
      message: 'Privado finalizado.',
      session: serializePrivateSession(session),
    });
  } catch (error) {
    next(error);
  }
};

const joinSession = async (req, res, next) => {
  try {
    const result = await joinPrivateSession({
      sessionId: req.params.id,
      user: req.user,
    });

    res.json({
      session: serializePrivateSession(result.session),
      token: result.token,
      url: result.url,
      roomName: result.session.roomName,
      canPublish: result.canPublish,
      room: result.room ? { name: result.room.name, metadata: result.room.metadata } : null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPrivateSessionConfig: getPrivateSessionConfigHandler,
  getStreamPrivateSessions,
  requestSession,
  getPrivateSession,
  confirmSession,
  rejectSession,
  cancelSession,
  endSession,
  joinSession,
};
