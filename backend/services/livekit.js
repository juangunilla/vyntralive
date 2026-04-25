const {
  AccessToken,
  IngressClient,
  IngressInput,
  RoomServiceClient,
} = require('livekit-server-sdk');

const createLiveSession = async ({
  roomName,
  userId,
  canPublish = false,
  canPublishData = true,
  displayName,
}) => {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: userId.toString(),
      name: displayName || userId.toString(),
    }
  );

  // Set room permissions
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: canPublish,
    canSubscribe: true,
    canPublishData,
  });

  const jwt = await token.toJwt();
  return {
    roomName,
    token: jwt,
    url: process.env.LIVEKIT_URL || 'wss://your-livekit-server.livekit.cloud',
    canPublish,
  };
};

const getIngressInputType = () => {
  const configuredInput = (process.env.LIVEKIT_INGRESS_INPUT || 'RTMP').toUpperCase();
  return configuredInput === 'WHIP' ? IngressInput.WHIP_INPUT : IngressInput.RTMP_INPUT;
};

const getIngressInputLabel = (inputType) => IngressInput[inputType] || 'RTMP_INPUT';

const normalizeLivekitControlUrl = (livekitUrl) => {
  if (!livekitUrl) {
    throw new Error('LIVEKIT_URL no está configurado');
  }

  return livekitUrl
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://');
};

const getIngressClient = () => {
  const livekitHost = process.env.LIVEKIT_URL;
  if (!livekitHost) {
    throw new Error('LIVEKIT_URL no está configurado');
  }

  return new IngressClient(
    livekitHost,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
  );
};

const getRoomServiceClient = () => new RoomServiceClient(
  normalizeLivekitControlUrl(process.env.LIVEKIT_URL),
  process.env.LIVEKIT_API_KEY,
  process.env.LIVEKIT_API_SECRET,
);

const getPrivateRoomConfig = () => ({
  emptyTimeout: Math.max(60, Number(process.env.PRIVATE_ROOM_EMPTY_TIMEOUT || 300)),
  departureTimeout: Math.max(30, Number(process.env.PRIVATE_ROOM_DEPARTURE_TIMEOUT || 120)),
  maxParticipants: Math.max(2, Number(process.env.PRIVATE_ROOM_MAX_PARTICIPANTS || 2)),
});

const listActiveRooms = async (roomNames = []) => {
  const roomServiceClient = getRoomServiceClient();
  const rooms = await roomServiceClient.listRooms(roomNames.length ? roomNames : undefined);

  return rooms.filter((room) => Number(room.numParticipants || 0) > 0);
};

const ensurePrivateRoom = async ({ roomName, metadata = '' }) => {
  const roomServiceClient = getRoomServiceClient();
  const roomMetadata = typeof metadata === 'string' ? metadata : JSON.stringify(metadata);
  const config = getPrivateRoomConfig();
  const existingRooms = await roomServiceClient.listRooms([roomName]);

  if (existingRooms.length > 0) {
    if (roomMetadata) {
      await roomServiceClient.updateRoomMetadata(roomName, roomMetadata);
    }

    return existingRooms[0];
  }

  return roomServiceClient.createRoom({
    name: roomName,
    emptyTimeout: config.emptyTimeout,
    departureTimeout: config.departureTimeout,
    maxParticipants: config.maxParticipants,
    metadata: roomMetadata,
  });
};

const listRoomParticipants = async (roomName) => {
  const roomServiceClient = getRoomServiceClient();
  return roomServiceClient.listParticipants(roomName);
};

const deleteRoom = async (roomName) => {
  if (!roomName) return;

  const roomServiceClient = getRoomServiceClient();
  await roomServiceClient.deleteRoom(roomName);
};

const createObsIngress = async ({ roomName, userId, userName, title }) => {
  const ingressClient = getIngressClient();
  const inputType = getIngressInputType();
  const ingressInfo = await ingressClient.createIngress(inputType, {
    name: `${title || roomName} OBS`,
    roomName,
    participantIdentity: `obs-${roomName}`,
    participantName: `${userName || userId} (OBS)`,
    enableTranscoding: inputType !== IngressInput.WHIP_INPUT,
  });

  return {
    ingressId: ingressInfo.ingressId,
    serverUrl: ingressInfo.url,
    streamKey: ingressInfo.streamKey,
    inputType: getIngressInputLabel(ingressInfo.inputType),
  };
};

const deleteObsIngress = async (ingressId) => {
  if (!ingressId) return;

  const ingressClient = getIngressClient();
  await ingressClient.deleteIngress(ingressId);
};

module.exports = {
  createLiveSession,
  createObsIngress,
  deleteObsIngress,
  deleteRoom,
  ensurePrivateRoom,
  listActiveRooms,
  listRoomParticipants,
};
