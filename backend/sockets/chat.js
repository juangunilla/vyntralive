const Stream = require('../models/Stream');
const Message = require('../models/Message');

const initChatSocket = (io) => {
  const chat = io.of('/chat');

  chat.on('connection', (socket) => {
    let joinedStreamId = null;
    let joinedIsHost = false;

    const decrementViewerCount = async (streamId) => {
      if (!streamId) {
        return;
      }

      try {
        const stream = await Stream.findById(streamId);
        if (stream && stream.viewers > 0) {
          await stream.updateOne({ $inc: { viewers: -1 } });
        }
      } catch (error) {
        console.error('Chat leave error:', error.message);
      }
    };

    const endStreamRoom = async (streamId, { name = 'El streamer' } = {}) => {
      if (!streamId) {
        return;
      }

      try {
        const stream = await Stream.findById(streamId);
        if (!stream || stream.status !== 'live') {
          return;
        }

        stream.status = 'offline';
        stream.viewers = 0;
        await stream.save();

        chat.to(streamId).emit('systemMessage', `${name} cerró la room`);
        chat.to(streamId).emit('roomEnded', {
          streamId,
          reason: 'host_disconnected',
          message: `${name} cerró la room`,
        });
      } catch (error) {
        console.error('Chat end stream error:', error.message);
      }
    };

    socket.on('joinRoom', async ({ streamId, userId, name }) => {
      socket.join(streamId);
      joinedStreamId = streamId;
      socket.data.userId = userId;
      socket.data.name = name;
      try {
        const stream = await Stream.findById(streamId);
        if (stream) {
          joinedIsHost = stream.creator.toString() === String(userId);
          await stream.updateOne({ $inc: { viewers: 1 } });
        }
      } catch (error) {
        console.error('Chat join error:', error.message);
      }

      chat.to(streamId).emit('systemMessage', `${name} se ha unido al chat`);
    });

    socket.on('sendMessage', async ({ streamId, userId, text, name }) => {
      if (!text || !streamId || !userId) return;
      const message = await Message.create({ stream: streamId, user: userId, text });
      chat.to(streamId).emit('newMessage', {
        id: message._id,
        userId,
        name,
        text,
        createdAt: message.createdAt,
      });
    });

    socket.on('leaveRoom', ({ streamId, name }) => {
      socket.leave(streamId);
      if (joinedStreamId === streamId) {
        joinedStreamId = null;
      }
      if (joinedIsHost) {
        joinedIsHost = false;
        endStreamRoom(streamId, { name });
        return;
      }

      chat.to(streamId).emit('systemMessage', `${name} ha salido del chat`);
      decrementViewerCount(streamId);
    });

    socket.on('disconnect', () => {
      if (!joinedStreamId) {
        return;
      }

      const streamId = joinedStreamId;
      joinedStreamId = null;

      if (joinedIsHost) {
        joinedIsHost = false;
        endStreamRoom(streamId, { name: socket.data.name });
        return;
      }

      decrementViewerCount(streamId);
      chat.to(streamId).emit('systemMessage', `${socket.data.name || 'Un usuario'} se desconectó del chat`);
    });
  });
};

module.exports = { initChatSocket };
