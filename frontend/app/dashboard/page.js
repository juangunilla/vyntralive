'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/api';

const depositStatusLabels = {
  pending: '🕓 Pendiente',
  approved: '✅ Aprobada',
  rejected: '❌ Rechazada',
};

const withdrawalStatusLabels = {
  pending: '🕓 Pendiente',
  paid: '💸 Pagado',
  rejected: '↩️ Rechazado',
};

const formatDateTime = (value) => new Date(value).toLocaleString('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export default function DashboardPage() {
  const [users, setUsers] = useState([]);
  const [streams, setStreams] = useState([]);
  const [depositRequests, setDepositRequests] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [depositNotes, setDepositNotes] = useState({});
  const [withdrawalNotes, setWithdrawalNotes] = useState({});
  const [paymentReferences, setPaymentReferences] = useState({});
  const [reviewingDepositId, setReviewingDepositId] = useState('');
  const [reviewingWithdrawalId, setReviewingWithdrawalId] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAdminData = async () => {
    const [resUsers, resStreams, resDepositRequests, resWithdrawalRequests] = await Promise.all([
      api.get('/admin/users'),
      api.get('/admin/streams'),
      api.get('/admin/deposit-requests'),
      api.get('/admin/withdrawal-requests'),
    ]);

    setUsers(resUsers.data);
    setStreams(resStreams.data);
    setDepositRequests(resDepositRequests.data);
    setWithdrawalRequests(resWithdrawalRequests.data);
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        await loadAdminData();
      } catch (err) {
        setError('Necesitas rol admin para ver este panel');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  const handleDepositReview = async (requestId, action) => {
    setError('');
    setFeedback('');
    setReviewingDepositId(requestId);

    try {
      const response = await api.patch(`/admin/deposit-requests/${requestId}`, {
        action,
        adminNote: depositNotes[requestId] || '',
      });

      setFeedback(response.data.message);
      setDepositNotes((current) => ({ ...current, [requestId]: '' }));
      await loadAdminData();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo revisar la solicitud');
    } finally {
      setReviewingDepositId('');
    }
  };

  const handleWithdrawalReview = async (requestId, action) => {
    setError('');
    setFeedback('');
    setReviewingWithdrawalId(requestId);

    try {
      const response = await api.patch(`/admin/withdrawal-requests/${requestId}`, {
        action,
        adminNote: withdrawalNotes[requestId] || '',
        paymentReference: paymentReferences[requestId] || '',
      });

      setFeedback(response.data.message);
      setWithdrawalNotes((current) => ({ ...current, [requestId]: '' }));
      setPaymentReferences((current) => ({ ...current, [requestId]: '' }));
      await loadAdminData();
    } catch (err) {
      setError(err.response?.data?.message || 'No se pudo revisar el retiro');
    } finally {
      setReviewingWithdrawalId('');
    }
  };

  const creatorsCount = users.filter((user) => user.role === 'creator').length;
  const adminCount = users.filter((user) => user.role === 'admin').length;
  const liveCount = streams.filter((stream) => stream.status === 'live').length;
  const obsCount = streams.filter((stream) => stream.broadcastMode === 'obs').length;
  const totalCreditsBalance = users.reduce((total, user) => total + (user.credits || 0), 0);
  const totalPendingWithdrawalsBalance = users.reduce(
    (total, user) => total + (user.pendingWithdrawalCredits || 0),
    0,
  );
  const pendingDeposits = depositRequests.filter((request) => request.status === 'pending').length;
  const pendingWithdrawals = withdrawalRequests.filter((request) => request.status === 'pending').length;

  if (loading) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="loading">
            <div className="spinner"></div>
            Cargando panel admin...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="page-header">
          <div>
            <span className="page-kicker">⚙️ Sala de mando</span>
            <h1>Panel admin con cobros y retiros 🧠</h1>
            <p className="page-subtitle">
              Desde acá controlás usuarios, transmisiones, compras por transferencia y retiros manuales de modelos.
            </p>
          </div>
          <div className="page-aside">
            <span className="info-chip">👀 {liveCount} streams en vivo</span>
            <span className="info-chip">🏦 {pendingDeposits} depósitos pendientes</span>
            <span className="info-chip">🏧 {pendingWithdrawals} retiros pendientes</span>
          </div>
        </div>

        {error && <div className="warning">🔒 {error}</div>}
        {feedback && <div className="success">✨ {feedback}</div>}

        <div className="dashboard-grid">
          <div className="metric-card">
            <span>Usuarios</span>
            <div className="metric-value">{users.length}</div>
          </div>
          <div className="metric-card">
            <span>Creadores</span>
            <div className="metric-value">{creatorsCount}</div>
          </div>
          <div className="metric-card">
            <span>Admins</span>
            <div className="metric-value">{adminCount}</div>
          </div>
          <div className="metric-card">
            <span>Streams con OBS</span>
            <div className="metric-value">{obsCount}</div>
          </div>
          <div className="metric-card">
            <span>Créditos en usuarios</span>
            <div className="metric-value">{totalCreditsBalance}</div>
          </div>
          <div className="metric-card">
            <span>Créditos reservados</span>
            <div className="metric-value">{totalPendingWithdrawalsBalance}</div>
          </div>
          <div className="metric-card">
            <span>Depósitos pendientes</span>
            <div className="metric-value">{pendingDeposits}</div>
          </div>
          <div className="metric-card">
            <span>Retiros pendientes</span>
            <div className="metric-value">{pendingWithdrawals}</div>
          </div>
        </div>

        <div className="content-grid">
          <section className="card list-card">
            <div className="section-heading">
              <div>
                <span className="page-kicker">👥 Comunidad</span>
                <h2>Usuarios</h2>
              </div>
            </div>

            <ul className="data-list">
              {users.map((user) => {
                const roleLabel = user.role === 'admin'
                  ? '🛡️ Admin'
                  : user.role === 'creator'
                    ? '🎬 Creador'
                    : '👤 Usuario';

                return (
                  <li key={user._id} className="data-item">
                    <div className="item-copy">
                      <strong>{user.name}</strong>
                      <span className="muted-text">📧 {user.email}</span>
                      <span className="muted-text">
                        💎 {user.credits || 0} disponibles
                        {user.pendingWithdrawalCredits ? ` • 🏧 ${user.pendingWithdrawalCredits} reservados` : ''}
                      </span>
                    </div>
                    <span className="info-chip">{roleLabel}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card list-card">
            <div className="section-heading">
              <div>
                <span className="page-kicker">📡 Operación</span>
                <h2>Transmisiones</h2>
              </div>
            </div>

            <ul className="data-list">
              {streams.map((stream) => (
                <li key={stream._id} className="data-item">
                  <div className="item-copy">
                    <strong>{stream.title}</strong>
                    <span className="muted-text">👤 {stream.creator?.name || 'N/A'}</span>
                  </div>
                  <div className="stack-sm">
                    <span className={`status ${stream.status === 'live' ? 'status-live' : 'status-offline'}`}>
                      {stream.status === 'live' ? '🟢 En vivo' : '⚫ Offline'}
                    </span>
                    <span className="mode-badge">
                      {stream.broadcastMode === 'obs' ? 'OBS' : 'NAVEGADOR'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="card list-card admin-deposit-card">
          <div className="section-heading">
            <div>
              <span className="page-kicker">🏧 Pagos a modelos</span>
              <h2>Solicitudes de retiro</h2>
            </div>
            <span className="info-chip">Pendientes: {pendingWithdrawals}</span>
          </div>

          {withdrawalRequests.length === 0 ? (
            <div className="warning">Todavía no hay solicitudes de retiro.</div>
          ) : (
            <div className="admin-deposit-list">
              {withdrawalRequests.map((request) => {
                const requestId = request._id || request.id;
                return (
                  <div key={requestId} className="admin-deposit-item">
                    <div className="admin-deposit-main">
                      <div className="stack-sm">
                        <strong>🏧 {request.credits} créditos para retirar</strong>
                        <span className="muted-text">
                          👤 {request.user?.name} • 📧 {request.user?.email}
                        </span>
                        <span className="muted-text">
                          Titular: {request.accountHolder}
                          {request.bankName ? ` • ${request.bankName}` : ''}
                        </span>
                        {(request.alias || request.cbu || request.cvu) && (
                          <span className="muted-text">
                            {request.alias ? `Alias: ${request.alias}` : ''}
                            {request.alias && (request.cbu || request.cvu) ? ' • ' : ''}
                            {request.cbu ? `CBU: ${request.cbu}` : ''}
                            {request.cbu && request.cvu ? ' • ' : ''}
                            {request.cvu ? `CVU: ${request.cvu}` : ''}
                          </span>
                        )}
                        <span className="muted-text">{formatDateTime(request.createdAt)}</span>
                        {request.requesterNote && (
                          <span className="muted-text">📝 {request.requesterNote}</span>
                        )}
                        {request.paymentReference && (
                          <span className="muted-text">🔎 Ref. pago: {request.paymentReference}</span>
                        )}
                        {request.reviewedBy?.name && (
                          <span className="muted-text">
                            Revisó: {request.reviewedBy.name}
                            {request.reviewedAt ? ` • ${formatDateTime(request.reviewedAt)}` : ''}
                          </span>
                        )}
                        {request.adminNote && (
                          <span className="muted-text">⚙️ {request.adminNote}</span>
                        )}
                      </div>

                      <span className={`info-chip deposit-status-chip deposit-status-${request.status}`}>
                        {withdrawalStatusLabels[request.status] || request.status}
                      </span>
                    </div>

                    {request.status === 'pending' && (
                      <div className="admin-deposit-actions">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nota interna opcional"
                          value={withdrawalNotes[requestId] || ''}
                          onChange={(event) => setWithdrawalNotes((current) => ({
                            ...current,
                            [requestId]: event.target.value,
                          }))}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Referencia del pago"
                          value={paymentReferences[requestId] || ''}
                          onChange={(event) => setPaymentReferences((current) => ({
                            ...current,
                            [requestId]: event.target.value,
                          }))}
                        />
                        <div className="actions-row">
                          <button
                            type="button"
                            className="btn btn-success"
                            disabled={reviewingWithdrawalId === requestId}
                            onClick={() => handleWithdrawalReview(requestId, 'mark_paid')}
                          >
                            {reviewingWithdrawalId === requestId ? 'Procesando...' : '💸 Marcar pagado'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={reviewingWithdrawalId === requestId}
                            onClick={() => handleWithdrawalReview(requestId, 'reject')}
                          >
                            {reviewingWithdrawalId === requestId ? 'Procesando...' : '↩️ Rechazar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card list-card admin-deposit-card">
          <div className="section-heading">
            <div>
              <span className="page-kicker">🏦 Pagos manuales</span>
              <h2>Solicitudes de compra de créditos</h2>
            </div>
            <span className="info-chip">Pendientes: {pendingDeposits}</span>
          </div>

          {depositRequests.length === 0 ? (
            <div className="warning">Todavía no hay solicitudes de depósito.</div>
          ) : (
            <div className="admin-deposit-list">
              {depositRequests.map((request) => {
                const requestId = request._id || request.id;
                return (
                  <div key={requestId} className="admin-deposit-item">
                    <div className="admin-deposit-main">
                      <div className="stack-sm">
                        <strong>{request.packName}</strong>
                        <span className="muted-text">
                          👤 {request.user?.name} • 📧 {request.user?.email}
                        </span>
                        <span className="muted-text">
                          💸 ARS {request.amountArs?.toLocaleString('es-AR')} • 💎 {request.credits} créditos
                        </span>
                        <span className="muted-text">
                          Titular: {request.payerName} • {formatDateTime(request.createdAt)}
                        </span>
                        {request.transferReference && (
                          <span className="muted-text">🔎 {request.transferReference}</span>
                        )}
                        <a href={request.proofImage} target="_blank" rel="noreferrer" className="inline-link">
                          Ver comprobante
                        </a>
                        {request.reviewedBy?.name && (
                          <span className="muted-text">
                            Revisó: {request.reviewedBy.name}
                            {request.reviewedAt ? ` • ${formatDateTime(request.reviewedAt)}` : ''}
                          </span>
                        )}
                        {request.adminNote && (
                          <span className="muted-text">📝 {request.adminNote}</span>
                        )}
                      </div>

                      <span className={`info-chip deposit-status-chip deposit-status-${request.status}`}>
                        {depositStatusLabels[request.status] || request.status}
                      </span>
                    </div>

                    {request.status === 'pending' && (
                      <div className="admin-deposit-actions">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nota interna opcional"
                          value={depositNotes[requestId] || ''}
                          onChange={(event) => setDepositNotes((current) => ({
                            ...current,
                            [requestId]: event.target.value,
                          }))}
                        />
                        <div className="actions-row">
                          <button
                            type="button"
                            className="btn btn-success"
                            disabled={reviewingDepositId === requestId}
                            onClick={() => handleDepositReview(requestId, 'approve')}
                          >
                            {reviewingDepositId === requestId ? 'Procesando...' : '✅ Aprobar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={reviewingDepositId === requestId}
                            onClick={() => handleDepositReview(requestId, 'reject')}
                          >
                            {reviewingDepositId === requestId ? 'Procesando...' : '❌ Rechazar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
