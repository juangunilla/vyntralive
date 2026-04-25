'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Room,
  RoomEvent,
  createLocalVideoTrack,
  createLocalAudioTrack,
} from 'livekit-client';
import api from '../lib/api';

export default function LiveKitVideo({
  roomName,
  streamId,
  broadcastMode = 'browser',
  allowGuestPreview = false,
  joinRequest = null,
}) {
  const localContainerRef = useRef(null);
  const remoteContainerRef = useRef(null);
  const roomRef = useRef(null);
  const remoteTracksRef = useRef(new Map());
  const localTracksRef = useRef([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [canPublishToRoom, setCanPublishToRoom] = useState(false);
  const [localTrackPublished, setLocalTrackPublished] = useState(false);
  const [remoteTrackCount, setRemoteTrackCount] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const isObsMode = broadcastMode === 'obs';

  useEffect(() => {
    if (!roomName && !streamId) return;

    setError(null);
    setIsConnected(false);
    setCanPublishToRoom(false);
    setLocalTrackPublished(false);
    setRemoteTrackCount(0);
    setIsPreviewMode(Boolean(allowGuestPreview && streamId));
    clearRemoteTracks();
    clearLocalTracks();

    let isCancelled = false;
    const usePreview = Boolean(allowGuestPreview && streamId);

    const initLiveKit = async () => {
      try {
        const tokenResponse = joinRequest
          ? await joinRequest()
          : usePreview
            ? await api.get(`/streams/${streamId}/preview`)
            : await api.post('/streams/join', { roomName });

        const { token, url: roomUrl, canPublish } = tokenResponse.data;

        if (typeof token !== 'string' || !token) {
          throw new Error('No se pudo obtener el token de acceso');
        }

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        roomRef.current = room;

        room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
        room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
        room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        room.on(RoomEvent.ConnectionStateChanged, handleConnectionStateChanged);

        const livekitUrl = roomUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';
        await room.connect(livekitUrl, token);

        if (isCancelled) {
          room.disconnect();
          return;
        }

        setIsConnected(true);
        setCanPublishToRoom(Boolean(canPublish) && !usePreview);

        if (canPublish && !usePreview) {
          await startPublishing(room);
        }

        // Attach already existing remote tracks
        room.remoteParticipants.forEach((participant) => {
          participant.videoTrackPublications.forEach((publication) => {
            if (publication.track) {
              handleTrackSubscribed(publication.track, publication, participant);
            }
          });
        });
      } catch (err) {
        if (isCancelled) return;
        console.error('Error connecting to LiveKit:', err);
        setError(usePreview
          ? 'No se pudo cargar la vista previa de la room'
          : (err.message || 'Error al conectar con el servidor de video'));
      }
    };

    initLiveKit();

    return () => {
      isCancelled = true;
      clearRemoteTracks();
      clearLocalTracks();

      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        room.disconnect();
      }
    };
    }, [allowGuestPreview, joinRequest, roomName, streamId]);

  const startPublishing = async (room) => {
    try {
      const videoTrack = await createLocalVideoTrack({
        resolution: { width: 1280, height: 720 },
        facingMode: 'user',
      });

      const audioTrack = await createLocalAudioTrack();

      await room.localParticipant.publishTrack(videoTrack);
      await room.localParticipant.publishTrack(audioTrack);

      attachLocalTrack(videoTrack);
      setLocalTrackPublished(true);
    } catch (err) {
      console.error('Error publishing tracks:', err);
      setError('Error al acceder a la cámara o micrófono. Verifica los permisos.');
    }
  };

  const attachLocalTrack = (track) => {
    if (!localContainerRef.current) return;

    clearLocalTracks();

    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 10px;
      background: #000;
    `;

    track.attach(videoElement);
    localTracksRef.current = [track];
    localContainerRef.current.appendChild(videoElement);
  };

  const clearLocalTracks = () => {
    localTracksRef.current.forEach((track) => track.detach());
    localTracksRef.current = [];

    if (localContainerRef.current) {
      localContainerRef.current.replaceChildren();
    }
  };

  const handleParticipantConnected = (participant) => {
    participant.videoTrackPublications.forEach((publication) => {
      if (publication.track) {
        handleTrackSubscribed(publication.track, publication, participant);
      }
    });
  };

  const handleParticipantDisconnected = (participant) => {
    const entries = Array.from(remoteTracksRef.current.entries());
    entries.forEach(([key, value]) => {
      if (value.participantSid === participant.sid) {
        removeRemoteTrack(key);
      }
    });
  };

  const handleTrackSubscribed = (track, publication, participant) => {
    if (track.kind !== 'video') return;
    if (!remoteContainerRef.current) return;

    const trackKey = publication?.trackSid || track.sid || participant.sid;
    if (remoteTracksRef.current.has(trackKey)) return;

    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 220px;
    `;
    container.setAttribute('data-participant', participant.sid);

    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 10px;
      background: #000;
    `;

    const label = document.createElement('div');
    label.textContent = participant.identity || 'Participante';
    label.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.65);
      color: white;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
    `;

    container.appendChild(videoElement);
    container.appendChild(label);
    remoteContainerRef.current.appendChild(container);

    track.attach(videoElement);
    remoteTracksRef.current.set(trackKey, {
      container,
      element: videoElement,
      participantSid: participant.sid,
      track,
    });
    setRemoteTrackCount(remoteTracksRef.current.size);
  };

  const handleTrackUnsubscribed = (track, publication, participant) => {
    if (track.kind !== 'video') return;
    const trackKey = publication?.trackSid || track.sid || participant.sid;
    removeRemoteTrack(trackKey);
  };

  const removeRemoteTrack = (trackKey) => {
    const remoteTrack = remoteTracksRef.current.get(trackKey);
    if (!remoteTrack) return;

    remoteTrack.track.detach(remoteTrack.element);
    remoteTrack.container.remove();
    remoteTracksRef.current.delete(trackKey);
    setRemoteTrackCount(remoteTracksRef.current.size);
  };

  const clearRemoteTracks = () => {
    Array.from(remoteTracksRef.current.keys()).forEach((trackKey) => {
      removeRemoteTrack(trackKey);
    });

    if (remoteContainerRef.current) {
      remoteContainerRef.current.replaceChildren();
    }

    setRemoteTrackCount(0);
  };

  const handleConnectionStateChanged = (state) => {
    setIsConnected(state === 'connected');
  };

  if (error) {
    return (
      <div className="video-placeholder" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <h3>❌ Error de Conexión</h3>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
        >
          🔄 Reintentar
        </button>
      </div>
    );
  }

  const showRemoteAsPrimary = isObsMode || !canPublishToRoom || isPreviewMode;
  const showObsWaiting = isObsMode && isConnected && remoteTrackCount === 0;
  const primaryWaiting = showRemoteAsPrimary ? remoteTrackCount === 0 : !localTrackPublished;

  return (
    <div style={{ display: 'grid', gap: '1rem', height: '100%' }}>
      <div style={{ position: 'relative', minHeight: '260px' }}>
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 10 }}>
          <span className="status status-live">{isConnected ? '🟢 Conectado' : '🟡 Conectando'}</span>
        </div>
        {showRemoteAsPrimary ? (
          <div
            ref={remoteContainerRef}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#000',
              display: 'grid',
              gap: '10px',
            }}
          />
        ) : (
          <div
            ref={localContainerRef}
            style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000' }}
          />
        )}
        {primaryWaiting && (
          <div style={{
            position: 'absolute',
            inset: 0,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            pointerEvents: 'none',
            textAlign: 'center',
          }}>
            <p>
              {isPreviewMode
                ? 'Vista previa pública de la room.'
                : isObsMode
                ? 'La señal principal llegará desde OBS.'
                : showRemoteAsPrimary
                  ? 'La cámara del creador aparecerá aquí cuando empiece a transmitir.'
                  : 'Tu cámara se mostrará aquí cuando la transmisión comience.'}
            </p>
          </div>
        )}
      </div>

      {!isObsMode && canPublishToRoom && (
        <div style={{ display: 'grid', gap: '10px' }}>
          {remoteTrackCount === 0 && (
            <div style={{
              color: '#fff',
              textAlign: 'center',
              padding: '1.5rem',
              background: '#0a0f1b',
              borderRadius: '12px',
            }}>
              <h3>👀 Nadie más está al aire</h3>
              <p>Cuando entre otro participante, su video va a aparecer acá.</p>
            </div>
          )}
          <div ref={remoteContainerRef} style={{ display: 'grid', gap: '10px' }} />
        </div>
      )}

      {showObsWaiting && (
          <div style={{
            color: '#fff',
            textAlign: 'center',
            padding: '1.5rem',
            background: '#0a0f1b',
            borderRadius: '12px',
          }}>
            <h3>📺 Esperando la señal de video</h3>
            <p>Inicia la transmisión en OBS y la señal aparecerá aquí.</p>
          </div>
      )}
    </div>
  );
}
