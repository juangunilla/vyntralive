'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import LiveKitVideo from '../../../components/LiveKitVideo';
import { getStoredUser, setStoredUser } from '../../../lib/session';

const POLL_INTERVAL_MS = 5000;

const formatDuration = (totalSeconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatCount = (value) => new Intl.NumberFormat('es-AR').format(Number(value || 0));

export default function PrivateCallPage() {
  const params = useParams();
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(() => getStoredUser());
  const [now, setNow] = useState(Date.now());

  const currentUserId = user?._id || user?.id;
  const streamId = session?.stream?._id || session?.stream?.id;
  const isParticipant = Boolean(
    session
    && currentUserId
    && (
      currentUserId === (session.creator?._id || session.creator?.id)
      || currentUserId === (session.viewer?._id || session.viewer?.id)
    ),
  );
  const canJoinRoom = Boolean(session && ['confirmed', 'active'].includes(session.status) && isParticipant);
  const isEnded = Boolean(session && ['ended', 'rejected', 'cancelled', 'expired'].includes(session.status));

  const refreshSession = async () => {
    try {
      const response = await api.get(`/private-sessions/${params.id}`);
      const nextSession = response.data;
      setSession(nextSession);
      setError('');

      if (currentUserId) {
        const currentViewerId = nextSession.viewer?._id || nextSession.viewer?.id;
        const currentCreatorId = nextSession.creator?._id || nextSession.creator?.id;
        if (currentUserId === currentViewerId) {
          setStoredUser(nextSession.viewer);
          setUser(nextSession.viewer);
        } else if (currentUserId === currentCreatorId) {
          setStoredUser(nextSession.creator);
          setUser(nextSession.creator);
        }
      }
    } catch (fetchError) {
      const message = fetchError.response?.data?.message || 'No se pudo cargar el privado';
      setError(message);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, [params.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const poll = window.setInterval(() => {
      refreshSession();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(poll);
  }, [params.id]);

  useEffect(() => {
    if (isEnded && streamId) {
      const timer = window.setTimeout(() => {
        router.replace(`/stream/${streamId}`);
      }, 1800);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [isEnded, router, streamId]);

  const joinPrivateRoom = useMemo(() => (
    async () => api.post(`/private-sessions/${params.id}/join`)
  ), [params.id]);

  const handleFinishSession = async () => {
    try {
      await api.post(`/private-sessions/${params.id}/end`, {
        reason: 'La videollamada privada se cerró manualmente',
      });
      await refreshSession();
    } catch (finishError) {
      setError(finishError.response?.data?.message || 'No se pudo finalizar el privado');
    }
  };

  const startedAt = session?.startedAt ? new Date(session.startedAt).getTime() : null;
  const billedMinutes = Number(session?.billedMinutes || 0);
  const requestedMinutes = Number(session?.requestedMinutes || 0);
  const reservedCredits = Number(session?.reservedCredits || 0);
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  if (loading) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="loading">
            <div className="spinner" />
            Cargando privado...
          </div>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="card" style={{ textAlign: 'center' }}>
            <h3>❌ {error}</h3>
            <p style={{ color: '#718096' }}>
              Volvé a la room principal para pedir o revisar el privado.
            </p>
            {streamId && (
              <Link href={`/stream/${streamId}`} className="btn btn-primary">
                Volver a la room
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="app-container">
      <div className="main-content private-call-shell">
        <div className="private-call-header card">
          <div>
            <span className="page-kicker">🔒 Privado confirmado por backend</span>
            <h1>{session.stream?.title || 'Videollamada privada'}</h1>
            <p className="page-subtitle">
              Sólo entran la creadora y el usuario confirmado. La llamada se cobra por minuto mientras ambos estén conectados.
            </p>
          </div>

          <div className="private-call-actions">
            {streamId && (
              <Link href={`/stream/${streamId}`} className="btn btn-secondary">
                Volver a la room
              </Link>
            )}
            {canJoinRoom && (
              <button type="button" className="btn btn-success" onClick={handleFinishSession}>
                Finalizar privado
              </button>
            )}
          </div>
        </div>

        <div className="private-call-grid">
          <section className="card private-call-video-card">
            {session.status === 'confirmed' || session.status === 'active' ? (
              <LiveKitVideo
                roomName={session.roomName}
                broadcastMode="browser"
                joinRequest={joinPrivateRoom}
              />
            ) : (
              <div className="video-placeholder">
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <h3>⏳ Privado no disponible</h3>
                  <p style={{ color: '#718096' }}>
                    Este privado ya no puede abrirse.
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside className="private-call-sidebar">
            <div className="card">
              <span className="page-kicker">Estado</span>
              <h3>{session.status === 'active' ? 'En curso' : session.status === 'confirmed' ? 'Confirmado' : session.status}</h3>
              <p className="page-subtitle">
                {session.status === 'active'
                  ? 'La videollamada está corriendo y se factura por minuto.'
                  : 'Esperando que ambos entren para arrancar el reloj.'}
              </p>

              <div className="credit-grid compact-grid">
                <div className="credit-card">
                  <span>Tiempo transcurrido</span>
                  <strong className="credit-value">{session.startedAt ? formatDuration(elapsedSeconds) : '00:00'}</strong>
                </div>
                <div className="credit-card">
                  <span>Minutos cobrados</span>
                  <strong className="credit-value">{formatCount(billedMinutes)} / {formatCount(requestedMinutes)}</strong>
                </div>
                <div className="credit-card">
                  <span>Créditos reservados</span>
                  <strong className="credit-value">{formatCount(reservedCredits)}</strong>
                </div>
                <div className="credit-card">
                  <span>Siguiente minuto</span>
                  <strong className="credit-value">
                    {session.startedAt && session.status === 'active'
                      ? `${String(60 - (elapsedSeconds % 60 || 60)).padStart(2, '0')}s`
                      : '--'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="card">
              <span className="page-kicker">Participantes</span>
              <div className="profile-list">
                <div className="profile-list-item">
                  Creador: {session.creator?.name || 'Streamer'}
                </div>
                <div className="profile-list-item">
                  Viewer: {session.viewer?.name || 'Usuario'}
                </div>
                <div className="profile-list-item">
                  Precio por minuto: {formatCount(session.ratePerMinute)} fichas
                </div>
                <div className="profile-list-item">
                  Mínimo: {formatCount(session.requestedMinutes)} minutos
                </div>
              </div>
            </div>

            {isEnded && (
              <div className="card">
                <span className="page-kicker">Cierre</span>
                <h3>Privado finalizado</h3>
                <p className="page-subtitle">
                  La sala se cerró y cualquier saldo no usado se reembolsa automáticamente.
                </p>
              </div>
            )}
          </aside>
        </div>

        {error && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <strong>{error}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
