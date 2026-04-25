const Stream = require('../models/Stream');
const {
  createLiveSession,
  createObsIngress,
  deleteObsIngress,
  listActiveRooms,
} = require('../services/livekit');
const { transferCredits, serializePublicUser, serializeCreditTransaction } = require('../services/credits');

const OBS_SETUP_ERROR =
  'No se pudo preparar la conexión OBS. Verifica que LiveKit Ingress esté habilitado en tu proyecto.';
const STREAM_PUBLIC_FIELDS = '-obsIngressId -obsServerUrl -obsStreamKey -obsInputType -obsEnabled -obsError';

const formatObsSetupError = (error) => {
  const details = error?.message || '';

  if (details.includes('ingress not connected')) {
    return 'No se pudo preparar la conexión OBS. Falta LiveKit Ingress + Redis. En local ejecuta ./start-media.sh y vuelve a intentar.';
  }

  return `${OBS_SETUP_ERROR} ${details}`.trim();
};

const normalizeBroadcastMode = (value) => (value === 'obs' ? 'obs' : 'browser');
const getBroadcastMode = (stream) => stream.broadcastMode || 'browser';

const isStreamManager = (stream, user) => (
  user?.role === 'admin' || stream.creator.toString() === user?._id.toString()
);

const getObsConnectionPayload = (stream) => {
  if (stream.obsEnabled && stream.obsServerUrl && stream.obsStreamKey) {
    return {
      available: true,
      server: stream.obsServerUrl,
      streamKey: stream.obsStreamKey,
      inputType: stream.obsInputType || 'RTMP_INPUT',
    };
  }

  return {
    available: false,
    message: stream.obsError || OBS_SETUP_ERROR,
  };
};

const saveObsIngressDetails = (stream, obsIngress) => {
  stream.obsIngressId = obsIngress.ingressId;
  stream.obsServerUrl = obsIngress.serverUrl;
  stream.obsStreamKey = obsIngress.streamKey;
  stream.obsInputType = obsIngress.inputType;
  stream.obsEnabled = true;
  stream.obsError = '';
};

const clearObsIngressDetails = (stream, errorMessage = '') => {
  stream.obsIngressId = '';
  stream.obsServerUrl = '';
  stream.obsStreamKey = '';
  stream.obsInputType = '';
  stream.obsEnabled = false;
  stream.obsError = errorMessage;
};

const createOrRefreshObsIngress = async (stream, user, { regenerate = false } = {}) => {
  if (!isStreamManager(stream, user)) {
    const error = new Error('Acceso denegado');
    error.status = 403;
    throw error;
  }

  if (stream.status !== 'live') {
    const error = new Error('La transmisión debe estar en vivo para configurar OBS');
    error.status = 400;
    throw error;
  }

  if (getBroadcastMode(stream) !== 'obs') {
    const error = new Error('Esta transmisión está en modo navegador. Crea una transmisión en modo OBS para usar esa conexión.');
    error.status = 400;
    throw error;
  }

  if (regenerate && stream.obsIngressId) {
    try {
      await deleteObsIngress(stream.obsIngressId);
    } catch (error) {
      console.error('Error deleting OBS ingress:', error.message);
    }
    clearObsIngressDetails(stream);
  }

  if (stream.obsEnabled && stream.obsServerUrl && stream.obsStreamKey) {
    return stream;
  }

  try {
    const obsIngress = await createObsIngress({
      roomName: stream.roomName,
      userId: user._id.toString(),
      userName: user.name,
      title: stream.title,
    });
    saveObsIngressDetails(stream, obsIngress);
  } catch (error) {
    console.error('Error creating OBS ingress:', error.message);
    clearObsIngressDetails(stream, formatObsSetupError(error));
    throw error;
  } finally {
    await stream.save();
  }

  return stream;
};

const getActiveStreams = async (req, res, next) => {
  try {
    const streams = await Stream.find({ status: 'live' })
      .select(STREAM_PUBLIC_FIELDS)
      .populate('creator', 'name role avatar');

    if (streams.length === 0) {
      return res.json([]);
    }

    try {
      const activeRooms = await listActiveRooms(
        streams.map((stream) => stream.roomName).filter(Boolean),
      );
      const activeRoomNames = new Set(activeRooms.map((room) => room.name));

      return res.json(
        streams.filter((stream) => activeRoomNames.has(stream.roomName)),
      );
    } catch (error) {
      console.error('Error verifying active streams in LiveKit:', error.message);
      return res.json([]);
    }
  } catch (error) {
    next(error);
  }
};

const startStream = async (req, res, next) => {
  try {
    const { title } = req.body;
    const broadcastMode = normalizeBroadcastMode(req.body?.broadcastMode);
    if (!title) {
      return res.status(400).json({ message: 'El título de la transmisión es obligatorio' });
    }
    const roomName = `stream-${req.user._id}-${Date.now()}`;
    const liveSession = await createLiveSession({ roomName, userId: req.user._id });
    const stream = await Stream.create({
      title,
      creator: req.user._id,
      broadcastMode,
      status: 'live',
      roomName: liveSession.roomName,
      streamUrl: liveSession.url,
    });

    if (broadcastMode === 'obs') {
      try {
        await createOrRefreshObsIngress(stream, req.user);
      } catch (error) {
        // The transmission can still exist while OBS ingress is being fixed.
      }
    }

    res.status(201).json({
      ...stream.toObject(),
      token: liveSession.token,
      url: liveSession.url,
      obs: getObsConnectionPayload(stream),
    });
  } catch (error) {
    next(error);
  }
};

const getStreamById = async (req, res, next) => {
  try {
    const stream = await Stream.findById(req.params.id)
      .select(STREAM_PUBLIC_FIELDS)
      .populate('creator', 'name role avatar coverImage bio aboutMe wishlist tipMenu roomRules socials galleryImages');
    if (!stream) {
      return res.status(404).json({ message: 'Transmisión no encontrada' });
    }
    res.json(stream);
  } catch (error) {
    next(error);
  }
};

const getStreamPreview = async (req, res, next) => {
  try {
    const stream = await Stream.findById(req.params.id).select('roomName status');
    if (!stream || stream.status !== 'live') {
      return res.status(404).json({ message: 'La vista previa no está disponible' });
    }

    try {
      const activeRooms = await listActiveRooms([stream.roomName]);
      if (!activeRooms.length) {
        return res.status(404).json({ message: 'La vista previa no está disponible' });
      }
    } catch (error) {
      console.error('Error verifying preview room in LiveKit:', error.message);
      return res.status(503).json({ message: 'No se pudo cargar la vista previa ahora' });
    }

    const previewIdentity = `preview-${stream._id}-${Date.now()}`;
    const liveSession = await createLiveSession({
      roomName: stream.roomName,
      userId: previewIdentity,
      displayName: 'Preview Viewer',
      canPublish: false,
      canPublishData: false,
    });

    res.json({
      roomName: liveSession.roomName,
      token: liveSession.token,
      url: liveSession.url,
    });
  } catch (error) {
    next(error);
  }
};

const joinStream = async (req, res, next) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      return res.status(400).json({ message: 'El nombre de la sala es obligatorio' });
    }

    // Verify the stream exists and is active
    const stream = await Stream.findOne({ roomName, status: 'live' });
    if (!stream) {
      return res.status(404).json({ message: 'Transmisión no encontrada o no está activa' });
    }

    // Create a token for joining the stream
    const liveSession = await createLiveSession({
      roomName,
      userId: req.user._id,
      canPublish:
        getBroadcastMode(stream) === 'browser' &&
        req.user.role === 'creator' &&
        stream.creator.toString() === req.user._id.toString()
    });

    res.json({
      token: liveSession.token,
      url: liveSession.url,
      canPublish: liveSession.canPublish
    });
  } catch (error) {
    next(error);
  }
};

const upsertObsIngress = async (req, res, next) => {
  try {
    const stream = await Stream.findById(req.params.id);
    if (!stream) {
      return res.status(404).json({ message: 'Transmisión no encontrada' });
    }

    const regenerate = Boolean(req.body?.regenerate);

    try {
      await createOrRefreshObsIngress(stream, req.user, { regenerate });
      return res.json(getObsConnectionPayload(stream));
    } catch (error) {
      const status = error.status && error.status < 500 ? error.status : 503;
      if (status !== 503) {
        return res.status(status).json({ message: error.message });
      }
      return res.status(status).json(getObsConnectionPayload(stream));
    }
  } catch (error) {
    next(error);
  }
};

const tipStreamCreator = async (req, res, next) => {
  try {
    const stream = await Stream.findById(req.params.id).populate('creator', 'name role');
    if (!stream) {
      return res.status(404).json({ message: 'Transmisión no encontrada' });
    }

    if (stream.status !== 'live') {
      return res.status(400).json({ message: 'Solo puedes enviar propinas en transmisiones activas' });
    }

    if (!stream.creator?._id) {
      return res.status(400).json({ message: 'La transmisión no tiene un creador válido' });
    }

    const transferResult = await transferCredits({
      senderId: req.user._id,
      receiverId: stream.creator._id,
      amount: req.body?.amount,
      referenceStreamId: stream._id,
      senderDescription: `Propina enviada a ${stream.creator.name} en "${stream.title}"`,
      receiverDescription: `Propina recibida durante "${stream.title}"`,
    });

    const io = req.app.get('io');
    if (io) {
      io.of('/chat').to(stream._id.toString()).emit('tipMessage', {
        id: transferResult.senderTransaction?._id?.toString() || `${Date.now()}`,
        streamId: stream._id.toString(),
        userId: transferResult.sender._id.toString(),
        name: transferResult.sender.name,
        amount: transferResult.amount,
        text: `mandó ${transferResult.amount} fichas`,
        balanceAfter: transferResult.sender.credits,
        createdAt: transferResult.senderTransaction?.createdAt || new Date().toISOString(),
      });
    }

    res.json({
      message: `Enviaste ${transferResult.amount} créditos a ${stream.creator.name} 💸`,
      amount: transferResult.amount,
      user: serializePublicUser(transferResult.sender),
      creator: {
        _id: transferResult.receiver._id,
        name: transferResult.receiver.name,
        role: transferResult.receiver.role,
        credits: transferResult.receiver.credits,
      },
      transaction: serializeCreditTransaction(transferResult.senderTransaction),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveStreams,
  startStream,
  getStreamById,
  getStreamPreview,
  joinStream,
  upsertObsIngress,
  tipStreamCreator,
};
