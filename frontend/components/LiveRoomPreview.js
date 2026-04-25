'use client';

import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import api from '../lib/api';

export default function LiveRoomPreview({ streamId }) {
  const wrapperRef = useRef(null);
  const playerRef = useRef(null);
  const roomRef = useRef(null);
  const trackRef = useRef(null);
  const videoElementRef = useRef(null);
  const [shouldConnect, setShouldConnect] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!wrapperRef.current || shouldConnect) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldConnect(true);
          observer.disconnect();
        }
      },
      { rootMargin: '180px 0px', threshold: 0.2 },
    );

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [shouldConnect]);

  useEffect(() => {
    if (!shouldConnect || !streamId) return undefined;

    let isCancelled = false;
    setError('');
    setIsConnected(false);
    setHasVideo(false);

    const detachCurrentTrack = (resetState = true) => {
      if (trackRef.current && videoElementRef.current) {
        trackRef.current.detach(videoElementRef.current);
      }

      trackRef.current = null;
      videoElementRef.current = null;

      if (playerRef.current) {
        playerRef.current.replaceChildren();
      }

      if (resetState) {
        setHasVideo(false);
      }
    };

    const attachTrack = (track) => {
      if (!playerRef.current || track.kind !== 'video') return;
      if (trackRef.current?.sid === track.sid) return;

      detachCurrentTrack();

      const videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.className = 'stream-preview-video';

      track.attach(videoElement);
      playerRef.current.appendChild(videoElement);
      trackRef.current = track;
      videoElementRef.current = videoElement;
      setHasVideo(true);
    };

    const attachFirstRemoteVideo = (room) => {
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.videoTrackPublications.values()) {
          if (publication.track) {
            attachTrack(publication.track);
            return;
          }
        }
      }
    };

    const connectPreview = async () => {
      try {
        const response = await api.get(`/streams/${streamId}/preview`);
        if (isCancelled) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (!isCancelled) {
            setIsConnected(state === 'connected');
          }
        });

        room.on(RoomEvent.TrackSubscribed, (track) => {
          if (!trackRef.current && track.kind === 'video') {
            attachTrack(track);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind !== 'video' || trackRef.current?.sid !== track.sid) return;
          detachCurrentTrack();
          attachFirstRemoteVideo(room);
        });

        await room.connect(
          response.data.url || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880',
          response.data.token,
        );

        if (isCancelled) {
          room.disconnect();
          return;
        }

        attachFirstRemoteVideo(room);
      } catch (previewError) {
        if (isCancelled) return;
        console.error('Error loading room preview:', previewError);
        setError('Preview no disponible');
      }
    };

    connectPreview();

    return () => {
      isCancelled = true;
      detachCurrentTrack(false);

      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        room.disconnect();
      }
    };
  }, [shouldConnect, streamId]);

  return (
    <div ref={wrapperRef} className="stream-preview-shell">
      <div ref={playerRef} className={`stream-preview-player ${hasVideo ? 'stream-preview-player-ready' : ''}`} />

      {!hasVideo && (
        <div className="stream-preview-fallback">
          <span className="stream-preview-copy">
            {error || (shouldConnect ? 'Cargando preview...' : 'Preview live')}
          </span>
        </div>
      )}

      {isConnected && <span className="stream-preview-status">LIVE PREVIEW</span>}
    </div>
  );
}
