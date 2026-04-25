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

const listActiveRooms = async (roomNames = []) => {
  const roomServiceClient = getRoomServiceClient();
  const rooms = await roomServiceClient.listRooms(roomNames.length ? roomNames : undefined);

  return rooms.filter((room) => Number(room.numParticipants || 0) > 0);
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
  listActiveRooms,
};
