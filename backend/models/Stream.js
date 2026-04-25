const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    broadcastMode: { type: String, enum: ['browser', 'obs'], default: 'browser' },
    status: { type: String, enum: ['live', 'offline'], default: 'offline' },
    viewers: { type: Number, default: 0 },
    roomName: { type: String, required: true },
    streamUrl: { type: String, default: '' },
    obsIngressId: { type: String, default: '' },
    obsServerUrl: { type: String, default: '' },
    obsStreamKey: { type: String, default: '' },
    obsInputType: { type: String, default: '' },
    obsEnabled: { type: Boolean, default: false },
    obsError: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Stream', streamSchema);
