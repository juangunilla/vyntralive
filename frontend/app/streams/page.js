'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';
import LiveRoomPreview from '../../components/LiveRoomPreview';
import { getStoredUser, setStoredUser } from '../../lib/session';

export default function StreamsPage() {
  const router = useRouter();
  const [streams, setStreams] = useState([]);
  const [title, setTitle] = useState('');
  const [broadcastMode, setBroadcastMode] = useState('browser');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [user, setUser] = useState(null);
  const [obsConfigs, setObsConfigs] = useState({});
  const [obsLoadingId, setObsLoadingId] = useState('');

  useEffect(() => {
    const currentUser = getStoredUser();
    setUser(currentUser);
    if (currentUser) {
      api.get('/users/profile')
        .then((response) => {
          setStoredUser(response.data);
          setUser(response.data);
        })
        .catch(() => {});
    }
    fetchStreams();
  }, []);

  const fetchStreams = async () => {
    try {
      const response = await api.get('/streams/active');
      setStreams(response.data);
    } catch (error) {
      console.error('Error fetching streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!user || !['creator', 'admin'].includes(user.role)) {
      setMessageType('error');
      setMessage('Solo los creadores pueden iniciar transmisiones');
      return;
    }

    setMessage('');
    setMessageType('');
    setStarting(true);
    try {
      const response = await api.post('/streams/start', { title, broadcastMode });
      const createdStream = response.data;

      setTitle('');
      setStreams((currentStreams) => {
        const remainingStreams = currentStreams.filter((stream) => stream._id !== createdStream._id);
        return [createdStream, ...remainingStreams];
      });

      if (createdStream.broadcastMode === 'obs' && createdStream.obs) {
        setObsConfigs((currentConfigs) => ({
          ...currentConfigs,
          [createdStream._id]: createdStream.obs,
        }));
      }

      if (createdStream.broadcastMode === 'browser') {
        setMessageType('success');
        setMessage('Transmisión creada. Entrando a tu sala...');
        router.push(`/stream/${createdStream._id}`);
        return;
      }

      if (createdStream.broadcastMode === 'obs') {
        setMessageType(createdStream.obs?.available ? 'success' : 'warning');
        setMessage(
          createdStream.obs?.available
            ? 'Sala OBS creada. Conecta tu señal para que aparezca en vivo en el listado.'
            : 'Sala OBS creada, pero falta preparar la conexión de Ingress.',
        );
      }
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.message || 'Error al iniciar transmisión');
    } finally {
      setStarting(false);
    }
  };

  const isStreamOwner = (stream) => (
    user && (user.role === 'admin' || stream.creator?._id === (user._id || user.id))
  );

  const getBroadcastMode = (stream) => stream.broadcastMode || 'browser';

  const handleObsAccess = async (streamId, regenerate = false) => {
    setObsLoadingId(streamId);
    try {
      const response = await api.post(`/streams/${streamId}/obs`, regenerate ? { regenerate: true } : {});
      setObsConfigs((currentConfigs) => ({
        ...currentConfigs,
        [streamId]: response.data,
      }));
      setMessageType(response.data.available ? 'success' : 'warning');
      setMessage(
        response.data.available
          ? (regenerate ? 'Clave OBS regenerada.' : 'Credenciales OBS listas.')
          : (response.data.message || 'No se pudo preparar OBS para esta transmisión.'),
      );
    } catch (error) {
      const responseData = error.response?.data;
      if (responseData?.available === false) {
        setObsConfigs((currentConfigs) => ({
          ...currentConfigs,
          [streamId]: responseData,
        }));
      }
      setMessageType('error');
      setMessage(responseData?.message || 'No se pudo preparar la conexión con OBS.');
    } finally {
      setObsLoadingId('');
    }
  };

  const copyToClipboard = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessageType('success');
      setMessage(`${label} copiado al portapapeles.`);
    } catch (error) {
      setMessageType('error');
      setMessage(`No se pudo copiar ${label.toLowerCase()}.`);
    }
  };

  const liveCount = streams.filter((stream) => stream.status === 'live').length;
  const creatorCount = new Set(
    streams.map((stream) => stream.creator?._id || stream.creator?.name).filter(Boolean),
  ).size;
  const obsCount = streams.filter((stream) => getBroadcastMode(stream) === 'obs').length;
  const roleLabel = user?.role === 'admin'
    ? '🛡️ Admin'
    : user?.role === 'creator'
      ? '🎬 Creador'
      : user?.role
        ? '👥 Usuario'
        : '🙈 Visitante';
  const getStreamTags = (stream) => {
    const tags = [
      getBroadcastMode(stream) === 'obs' ? 'OBS room' : 'Webcam room',
      (stream.viewers || 0) > 10 ? 'Hot now' : 'Live chat',
    ];

    if ((stream.creator?.role || '') === 'creator') {
      tags.push('Creator');
    }

    return tags;
  };
  const getHostInitial = (stream) => (stream.creator?.name || 'L').trim().charAt(0).toUpperCase();

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="page-header">
          <div>
            <span className="page-kicker">🔴 Directorio live</span>
            <h1>Salas en vivo con vibe de cam platform.</h1>
            <p className="page-subtitle">
              Entrá a rooms activas, mirá quién está arriba, abrí tu sala y movete con una
              navegación más de directorio que de landing tradicional.
            </p>
          </div>
          <div className="page-aside">
            <span className="info-chip">🔴 {liveCount} en vivo</span>
            <span className="info-chip">👤 {creatorCount} hosts</span>
            <span className="info-chip">🎛️ {obsCount} OBS</span>
            <span className="profile-badge">{roleLabel}</span>
            {user && <span className="info-chip">💎 {user.credits || 0} créditos</span>}
          </div>
        </div>

        {['creator', 'admin'].includes(user?.role) && (
          <div className="card broadcast-dock" style={{ marginBottom: '2rem' }}>
            <div className="section-heading">
              <div>
                <span className="page-kicker">🎬 Broadcast dock</span>
                <h2>Abrí una room nueva</h2>
              </div>
              <p className="page-subtitle">
                Elegí tu modo de emisión y levantá la sala con el mismo lenguaje visual del directorio.
              </p>
            </div>

            <div className="form-stack">
              <input
                type="text"
                placeholder="Título de la room"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
              />

              <div className="form-group">
                <span className="form-label">Modo de emisión</span>
                <div className="mode-selector">
                  <button
                    type="button"
                    className={`mode-option ${broadcastMode === 'browser' ? 'mode-option-active' : ''}`}
                    onClick={() => setBroadcastMode('browser')}
                  >
                    <strong>🌐 Browser cam</strong>
                    <span>Entrás al instante con cámara y micro desde el navegador.</span>
                  </button>
                  <button
                    type="button"
                    className={`mode-option ${broadcastMode === 'obs' ? 'mode-option-active' : ''}`}
                    onClick={() => setBroadcastMode('obs')}
                  >
                    <strong>🎛️ OBS room</strong>
                    <span>Configuración más pro con señal externa e Ingress.</span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleStart}
                className="btn btn-success"
                disabled={!title.trim() || starting}
              >
                {starting ? 'Preparando...' : '🚀 Iniciar transmisión'}
              </button>
            </div>
            {message && (
              <div className={messageType === 'error' ? 'error' : messageType === 'warning' ? 'warning' : 'success'} style={{ marginTop: '1rem' }}>
                {message}
              </div>
            )}
          </div>
        )}

        {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              Cargando transmisiones...
            </div>
          ) : streams.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3>📭 No hay transmisiones activas</h3>
            <p style={{ color: '#718096' }}>
              {user?.role === 'creator'
                ? '¡Sé el primero en transmitir y prendé el ambiente! 😎'
                : 'Regresá más tarde o convertite en creador para salir al aire.'
              }
            </p>
          </div>
        ) : (
          <div className="directory-grid">
            {streams.map((stream) => (
              <div key={stream._id} className={`card stream-tile ${stream.status === 'live' ? 'card-live' : 'card-offline'}`}>
                <div className={`stream-tile-cover ${getBroadcastMode(stream) === 'obs' ? 'stream-tile-cover-obs' : 'stream-tile-cover-browser'}`}>
                  <LiveRoomPreview streamId={stream._id} />

                  <div className="stream-tile-overlay">
                    <div className="stream-tile-badges">
                      <span className={`status ${stream.status === 'live' ? 'status-live' : 'status-offline'}`}>
                        {stream.status === 'live' ? '🔴 EN VIVO' : '⚫ OFFLINE'}
                      </span>
                      <span className="info-chip">👥 {stream.viewers || 0}</span>
                    </div>

                    <div className="stream-tile-host">
                      <span className="host-avatar">{getHostInitial(stream)}</span>
                      <div className="stack-sm">
                        <strong>{stream.creator?.name || 'Creador'}</strong>
                        <span className="meta-item">
                          {getBroadcastMode(stream) === 'obs' ? 'Studio / OBS setup' : 'Browser / webcam setup'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="stream-tile-body">
                  <div className="stack-sm">
                    <h3>{stream.title}</h3>
                    <p className="muted-text">
                      Room lista para video, chat en vivo y soporte con créditos dentro de la plataforma.
                    </p>
                  </div>

                  <div className="tag-row">
                    {getStreamTags(stream).map((tag) => (
                      <span key={tag} className="tag-pill">{tag}</span>
                    ))}
                  </div>

                  {stream.status === 'live' && (
                    <div className="actions-row">
                      <Link href={`/stream/${stream._id}`} className="btn btn-primary btn-block">
                        🎥 Entrar a la room
                      </Link>

                      {isStreamOwner(stream) && getBroadcastMode(stream) === 'obs' && (
                        <button
                          onClick={() => handleObsAccess(stream._id)}
                          className="btn btn-secondary btn-block"
                          disabled={obsLoadingId === stream._id}
                        >
                          {obsLoadingId === stream._id
                            ? 'Preparando OBS...'
                            : obsConfigs[stream._id]?.available
                              ? '🔐 Ver Datos OBS'
                              : '📡 Conectar con OBS'}
                        </button>
                      )}
                    </div>
                  )}

                  {isStreamOwner(stream) && getBroadcastMode(stream) === 'obs' && obsConfigs[stream._id] && (
                    <div className="obs-panel">
                      <h4>🎛️ OBS Studio</h4>
                      {obsConfigs[stream._id].available ? (
                        <>
                          <p className="obs-help">
                            En OBS ve a `Settings` → `Stream` → `Service: Custom`.
                          </p>

                          <div className="obs-field">
                            <span className="obs-label">Server</span>
                            <code className="obs-code">{obsConfigs[stream._id].server}</code>
                            <button
                              onClick={() => copyToClipboard(obsConfigs[stream._id].server, 'Server')}
                              className="btn btn-secondary"
                              type="button"
                            >
                              📋 Copiar
                            </button>
                          </div>

                          <div className="obs-field">
                            <span className="obs-label">Stream Key</span>
                            <code className="obs-code">{obsConfigs[stream._id].streamKey}</code>
                            <button
                              onClick={() => copyToClipboard(obsConfigs[stream._id].streamKey, 'Stream Key')}
                              className="btn btn-secondary"
                              type="button"
                            >
                              📋 Copiar
                            </button>
                          </div>

                          <p className="obs-help">
                            Tipo de ingreso: <strong>{obsConfigs[stream._id].inputType}</strong>
                          </p>

                          <button
                            onClick={() => handleObsAccess(stream._id, true)}
                            className="btn btn-secondary"
                            disabled={obsLoadingId === stream._id}
                            type="button"
                          >
                            ♻️ Regenerar Clave
                          </button>
                        </>
                      ) : (
                        <div className="warning">
                          {obsConfigs[stream._id].message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
