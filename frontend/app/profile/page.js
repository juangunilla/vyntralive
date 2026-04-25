'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { getStoredUser, setStoredUser, clearSession } from '../../lib/session';

const transactionIcons = {
  welcome_bonus: '🎁',
  daily_bonus: '☀️',
  tip_sent: '💸',
  tip_received: '💖',
  admin_adjustment: '🛠️',
  deposit_approved: '🏦',
  withdrawal_request: '🏧',
  withdrawal_rejected_refund: '↩️',
};

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

const defaultForm = {
  name: '',
  bio: '',
  avatar: '',
  coverImage: '',
  galleryImages: [],
  aboutMe: '',
  wishlist: '',
  tipMenu: '',
  roomRules: '',
  socials: '',
  payoutAccountHolder: '',
  payoutBankName: '',
  payoutAlias: '',
  payoutCbu: '',
  payoutCvu: '',
};

const defaultDepositForm = {
  packId: '',
  payerName: '',
  transferReference: '',
  proof: null,
};

const defaultWithdrawalForm = {
  amount: '',
  accountHolder: '',
  bankName: '',
  alias: '',
  cbu: '',
  cvu: '',
  requesterNote: '',
};

const formatDateTime = (value) => new Date(value).toLocaleString('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const getInitials = (name = '') => (
  name
    .split(' ')
    .map((part) => part?.[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CB'
);

const splitLines = (value = '') => (
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
);

const mapProfileToForm = (profile = {}) => ({
  name: profile.name || '',
  bio: profile.bio || '',
  avatar: profile.avatar || '',
  coverImage: profile.coverImage || '',
  galleryImages: Array.isArray(profile.galleryImages) ? profile.galleryImages : [],
  aboutMe: profile.aboutMe || '',
  wishlist: profile.wishlist || '',
  tipMenu: profile.tipMenu || '',
  roomRules: profile.roomRules || '',
  socials: profile.socials || '',
  payoutAccountHolder: profile.payoutAccountHolder || '',
  payoutBankName: profile.payoutBankName || '',
  payoutAlias: profile.payoutAlias || '',
  payoutCbu: profile.payoutCbu || '',
  payoutCvu: profile.payoutCvu || '',
});

function ProfileInfoCard({ kicker, title, description, items, emptyText }) {
  return (
    <div className="card profile-section-card">
      <span className="page-kicker">{kicker}</span>
      <h3>{title}</h3>
      <p>{description}</p>

      {items.length === 0 ? (
        <div className="profile-empty-box">{emptyText}</div>
      ) : (
        <div className="profile-list">
          {items.map((item) => (
            <div key={`${title}-${item}`} className="profile-list-item">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(false);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [creditHistory, setCreditHistory] = useState([]);
  const [dailyBonusAmount, setDailyBonusAmount] = useState(0);
  const [depositConfig, setDepositConfig] = useState(null);
  const [depositRequests, setDepositRequests] = useState([]);
  const [depositLoading, setDepositLoading] = useState(true);
  const [depositForm, setDepositForm] = useState(defaultDepositForm);
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [withdrawalLoading, setWithdrawalLoading] = useState(true);
  const [withdrawalForm, setWithdrawalForm] = useState(defaultWithdrawalForm);
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [uploading, setUploading] = useState({
    avatar: false,
    cover: false,
    gallery: false,
  });

  const syncProfileState = (profile) => {
    setStoredUser(profile);
    setUser(profile);
    setForm(mapProfileToForm(profile));
    setWithdrawalForm((current) => ({
      ...current,
      accountHolder: profile.payoutAccountHolder || profile.name || '',
      bankName: profile.payoutBankName || '',
      alias: profile.payoutAlias || '',
      cbu: profile.payoutCbu || '',
      cvu: profile.payoutCvu || '',
    }));
  };

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.push('/login');
      return;
    }

    setUser(stored);
    setForm(mapProfileToForm(stored));
    setDepositForm((current) => ({
      ...current,
      payerName: current.payerName || stored.name || '',
    }));
    setWithdrawalForm((current) => ({
      ...current,
      accountHolder: current.accountHolder || stored.payoutAccountHolder || stored.name || '',
      bankName: current.bankName || stored.payoutBankName || '',
      alias: current.alias || stored.payoutAlias || '',
      cbu: current.cbu || stored.payoutCbu || '',
      cvu: current.cvu || stored.payoutCvu || '',
    }));

    const loadProfileData = async () => {
      try {
        const [
          profileResponse,
          creditsResponse,
          depositConfigResponse,
          depositRequestsResponse,
          withdrawalRequestsResponse,
        ] = await Promise.all([
          api.get('/users/profile'),
          api.get('/users/credits/history'),
          api.get('/users/credits/config'),
          api.get('/users/deposits'),
          api.get('/users/withdrawals'),
        ]);

        syncProfileState(profileResponse.data);
        setDailyBonusAmount(creditsResponse.data.dailyBonusAmount || 0);
        setCreditHistory(creditsResponse.data.transactions || []);
        setDepositConfig(depositConfigResponse.data);
        setDepositRequests(depositRequestsResponse.data || []);
        setWithdrawalRequests(withdrawalRequestsResponse.data || []);
        setDepositForm((current) => ({
          ...current,
          packId: current.packId || depositConfigResponse.data?.packs?.[0]?.id || '',
          payerName: current.payerName || profileResponse.data.name || '',
        }));
        setWithdrawalForm((current) => ({
          ...current,
          accountHolder: profileResponse.data.payoutAccountHolder || profileResponse.data.name || '',
          bankName: profileResponse.data.payoutBankName || '',
          alias: profileResponse.data.payoutAlias || '',
          cbu: profileResponse.data.payoutCbu || '',
          cvu: profileResponse.data.payoutCvu || '',
        }));
      } catch (error) {
        if (error.response?.status === 401) {
          clearSession();
          router.push('/login');
        }
      } finally {
        setHistoryLoading(false);
        setDepositLoading(false);
        setWithdrawalLoading(false);
      }
    };

    loadProfileData();
  }, [router]);

  const handleChange = (e) => {
    setForm((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const response = await api.put('/users/profile', form);
      syncProfileState(response.data);
      setMessage('Perfil actualizado correctamente ✨');
      setMessageType('success');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Error al guardar perfil');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimDaily = async () => {
    setClaimingDaily(true);
    setMessage('');
    setMessageType('');

    try {
      const response = await api.post('/users/credits/claim-daily');
      syncProfileState(response.data.user);
      setCreditHistory((currentHistory) => [
        response.data.transaction,
        ...currentHistory,
      ].slice(0, 12));
      setMessage(response.data.message);
      setMessageType('success');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo reclamar el bonus diario');
      setMessageType('error');
    } finally {
      setClaimingDaily(false);
    }
  };

  const handleUpload = async (kind, fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) {
      return;
    }

    setMessage('');
    setMessageType('');
    setUploading((current) => ({ ...current, [kind]: true }));

    try {
      const formData = new FormData();
      if (kind === 'gallery') {
        files.forEach((file) => formData.append('images', file));
      } else {
        formData.append('image', files[0]);
      }

      const response = await api.post(`/users/uploads/${kind}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      syncProfileState(response.data.user);
      setMessage(response.data.message || 'Imagen subida correctamente ✨');
      setMessageType('success');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo subir la imagen');
      setMessageType('error');
    } finally {
      setUploading((current) => ({ ...current, [kind]: false }));
    }
  };

  const handleRemoveGalleryImage = async (url) => {
    setMessage('');
    setMessageType('');

    try {
      const response = await api.delete('/users/uploads/gallery', {
        data: { url },
      });
      syncProfileState(response.data.user);
      setMessage(response.data.message || 'Foto eliminada de la galería');
      setMessageType('success');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo eliminar la foto');
      setMessageType('error');
    }
  };

  const handleDepositFieldChange = (event) => {
    const { name, value, files } = event.target;
    setDepositForm((current) => ({
      ...current,
      [name]: name === 'proof' ? (files?.[0] || null) : value,
    }));
  };

  const handleWithdrawalFieldChange = (event) => {
    const { name, value } = event.target;
    setWithdrawalForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleDepositSubmit = async () => {
    if (!depositForm.packId) {
      setMessage('Elegí un pack de créditos');
      setMessageType('error');
      return;
    }

    if (!depositForm.proof) {
      setMessage('Subí el comprobante de la transferencia');
      setMessageType('error');
      return;
    }

    setSubmittingDeposit(true);
    setMessage('');
    setMessageType('');

    try {
      const formData = new FormData();
      formData.append('packId', depositForm.packId);
      formData.append('payerName', depositForm.payerName);
      formData.append('transferReference', depositForm.transferReference);
      formData.append('proof', depositForm.proof);

      const response = await api.post('/users/deposits', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setDepositRequests((current) => [response.data.request, ...current]);
      setDepositForm((current) => ({
        ...current,
        transferReference: '',
        proof: null,
      }));
      setMessage(response.data.message || 'Solicitud enviada correctamente');
      setMessageType('success');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo enviar la solicitud');
      setMessageType('error');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleWithdrawalSubmit = async () => {
    const amount = Number(withdrawalForm.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage('Indicá una cantidad entera de créditos para retirar');
      setMessageType('error');
      return;
    }

    setSubmittingWithdrawal(true);
    setMessage('');
    setMessageType('');

    try {
      const payload = {
        amount,
        accountHolder: withdrawalForm.accountHolder,
        bankName: withdrawalForm.bankName,
        alias: withdrawalForm.alias,
        cbu: withdrawalForm.cbu,
        cvu: withdrawalForm.cvu,
        requesterNote: withdrawalForm.requesterNote,
      };

      const response = await api.post('/users/withdrawals', payload);
      syncProfileState(response.data.user);
      setWithdrawalRequests((current) => [response.data.request, ...current]);
      setCreditHistory((currentHistory) => [
        response.data.transaction,
        ...currentHistory,
      ].filter(Boolean).slice(0, 12));
      setWithdrawalForm((current) => ({
        ...current,
        amount: '',
        requesterNote: '',
      }));
      setMessage(response.data.message || 'Solicitud de retiro enviada');
      setMessageType('success');
    } catch (error) {
      setMessage(error.response?.data?.message || 'No se pudo pedir el retiro');
      setMessageType('error');
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const aboutItems = useMemo(() => splitLines(form.aboutMe || form.bio), [form.aboutMe, form.bio]);
  const wishlistItems = useMemo(() => splitLines(form.wishlist), [form.wishlist]);
  const tipMenuItems = useMemo(() => splitLines(form.tipMenu), [form.tipMenu]);
  const rulesItems = useMemo(() => splitLines(form.roomRules), [form.roomRules]);
  const socialItems = useMemo(() => splitLines(form.socials), [form.socials]);
  const galleryImages = useMemo(
    () => (Array.isArray(form.galleryImages) ? form.galleryImages : []),
    [form.galleryImages],
  );
  const selectedPack = useMemo(
    () => depositConfig?.packs?.find((pack) => pack.id === depositForm.packId) || null,
    [depositConfig, depositForm.packId],
  );
  const canRequestWithdrawals = user?.role === 'creator' || user?.role === 'admin';

  if (!user) {
    return (
      <div className="app-container">
        <div className="main-content">
          <div className="loading">
            <div className="spinner"></div>
            Cargando perfil...
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = user.role === 'admin'
    ? '🛡️ Admin'
    : user.role === 'creator'
      ? '🎬 Creador'
      : '👥 Usuario';
  const avatarUrl = form.avatar || user.avatar;
  const coverImage = form.coverImage || user.coverImage;
  const initials = getInitials(form.name || user.name);
  const nextDailyBonusText = user.canClaimDaily
    ? 'Disponible ahora'
    : user.nextDailyCreditAt
      ? `Vuelve ${formatDateTime(user.nextDailyCreditAt)}`
      : 'Disponible ahora';

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="page-header">
          <div>
            <span className="page-kicker">👤 Performer profile</span>
            <h1>Mi perfil y mi room identity.</h1>
            <p className="page-subtitle">
              Ahora podés subir fotos de verdad para avatar, portada y galería del canal, además
              de completar el resto de la performer page.
            </p>
          </div>
          <div className="page-aside">
            <span className="profile-badge">{roleLabel}</span>
            <span className="info-chip">💎 {user.credits || 0} créditos</span>
          </div>
        </div>

        <section className="profile-hero-shell">
          <div
            className="profile-cover-card"
            style={coverImage ? { backgroundImage: `linear-gradient(180deg, rgba(5, 9, 17, 0.18), rgba(5, 9, 17, 0.82)), url(${coverImage})` } : undefined}
          >
            <div className="profile-cover-overlay">
              <div className="profile-identity">
                <div className="profile-avatar-lg">
                  {avatarUrl ? <img src={avatarUrl} alt={`Avatar de ${user.name}`} /> : initials}
                </div>

                <div className="profile-identity-copy">
                  <span className="page-kicker">🔴 My profile</span>
                  <h2>{form.name || user.name}</h2>
                  <p>{form.bio || 'Configura una headline corta para tu perfil.'}</p>
                  <div className="room-chip-row">
                    <span className="info-chip">{roleLabel}</span>
                    <span className="info-chip">📧 {user.email}</span>
                    <span className="info-chip">💖 {user.totalCreditsEarned || 0} ganados</span>
                    <span className="info-chip">🖼️ {galleryImages.length} fotos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-layout performer-profile-layout">
          <aside className="card profile-summary performer-sidebar">
            <div className="credit-grid">
              <div className="credit-card">
                <span>Saldo actual</span>
                <strong className="credit-value">{user.credits || 0}</strong>
              </div>
              <div className="credit-card">
                <span>Total ganado</span>
                <strong className="credit-value">{user.totalCreditsEarned || 0}</strong>
              </div>
              <div className="credit-card">
                <span>Total gastado</span>
                <strong className="credit-value">{user.totalCreditsSpent || 0}</strong>
              </div>
              <div className="credit-card">
                <span>En retiro</span>
                <strong className="credit-value">{user.pendingWithdrawalCredits || 0}</strong>
              </div>
              <div className="credit-card">
                <span>Ya retirado</span>
                <strong className="credit-value">{user.totalCreditsWithdrawn || 0}</strong>
              </div>
            </div>

            <div className="credit-action-card">
              <span className="page-kicker">☀️ Bonus diario</span>
              <h3>Reclamá tus créditos</h3>
              <p>
                Sumá {dailyBonusAmount || 0} créditos cada 24 horas para usar en tips o guardar saldo.
              </p>
              <button
                type="button"
                className="btn btn-success btn-block"
                onClick={handleClaimDaily}
                disabled={claimingDaily || !user.canClaimDaily}
              >
                {claimingDaily ? 'Reclamando...' : user.canClaimDaily ? '✨ Reclamar bonus' : '⏳ En cooldown'}
              </button>
              <p className="credit-note">{nextDailyBonusText}</p>
            </div>

            <div className="support-panel">
              <div className="support-item">
                <div className="feature-icon">📤</div>
                <div className="stack-sm">
                  <strong>Subidas reales</strong>
                  <p>Avatar, portada y galería ya aceptan imágenes locales, no solo URLs pegadas a mano.</p>
                </div>
              </div>
              <div className="support-item">
                <div className="feature-icon">🌫️</div>
                <div className="stack-sm">
                  <strong>Fotos difuminadas para viewers</strong>
                  <p>En la sala, si no sos el dueño, la galería del creador se muestra con blur.</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="profile-content">
            <div className="content-grid performer-section-grid">
              {depositConfig && (
                <div className="card profile-section-card deposit-purchase-card">
                  <span className="page-kicker">🏦 Compra por transferencia</span>
                  <h3>Cargá créditos manualmente</h3>
                  <p>
                    Transferí a los datos de abajo, subí el comprobante y un admin acredita el pack elegido.
                  </p>

                  <div className="deposit-bank-grid">
                    <div className="credit-card">
                      <span>Titular</span>
                      <strong>{depositConfig.bankOwner}</strong>
                    </div>
                    <div className="credit-card">
                      <span>Banco</span>
                      <strong>{depositConfig.bankName}</strong>
                    </div>
                    <div className="credit-card">
                      <span>Alias</span>
                      <strong>{depositConfig.alias}</strong>
                    </div>
                    {(depositConfig.cvu || depositConfig.cbu) && (
                      <div className="credit-card">
                        <span>{depositConfig.cvu ? 'CVU' : 'CBU'}</span>
                        <strong>{depositConfig.cvu || depositConfig.cbu}</strong>
                      </div>
                    )}
                  </div>

                  <div className="warning">
                    {depositConfig.note}
                  </div>

                  <div className="deposit-pack-grid">
                    {depositConfig.packs?.map((pack) => (
                      <button
                        key={pack.id}
                        type="button"
                        className={`mode-option ${depositForm.packId === pack.id ? 'mode-option-active' : ''}`}
                        onClick={() => setDepositForm((current) => ({ ...current, packId: pack.id }))}
                      >
                        <strong>{pack.label}</strong>
                        <span>💎 {pack.credits} créditos</span>
                        <span>💸 ARS {pack.amountArs.toLocaleString('es-AR')}</span>
                        <span>{pack.bonusLabel}</span>
                      </button>
                    ))}
                  </div>

                  <div className="form-stack">
                    <div className="form-group">
                      <label className="form-label">👤 Titular de la transferencia</label>
                      <input
                        type="text"
                        name="payerName"
                        className="form-input"
                        value={depositForm.payerName}
                        onChange={handleDepositFieldChange}
                        placeholder="Nombre del titular"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">🔎 Referencia o aclaración</label>
                      <input
                        type="text"
                        name="transferReference"
                        className="form-input"
                        value={depositForm.transferReference}
                        onChange={handleDepositFieldChange}
                        placeholder="Últimos 4 dígitos, hora, banco, etc."
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">🧾 Comprobante</label>
                      <input
                        type="file"
                        name="proof"
                        accept="image/*"
                        className="upload-input"
                        onChange={handleDepositFieldChange}
                      />
                      <p className="upload-helper">
                        {depositForm.proof
                          ? `Archivo listo: ${depositForm.proof.name}`
                          : 'Subí una captura o foto clara del comprobante'}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-success btn-block"
                      disabled={submittingDeposit || !selectedPack}
                      onClick={handleDepositSubmit}
                    >
                      {submittingDeposit
                        ? 'Enviando solicitud...'
                        : selectedPack
                          ? `🏦 Solicitar ${selectedPack.credits} créditos`
                          : 'Elegí un pack'}
                    </button>
                  </div>
                </div>
              )}

              {canRequestWithdrawals && (
                <div className="card profile-section-card withdrawal-request-card">
                  <span className="page-kicker">🏧 Retiros para modelos</span>
                  <h3>Pedí que te paguen tus créditos</h3>
                  <p>
                    Cuando envíes la solicitud, esos créditos quedan reservados y el admin los verá en su panel
                    para pagarte manualmente a tu alias, CBU o CVU.
                  </p>

                  <div className="deposit-bank-grid">
                    <div className="credit-card">
                      <span>Disponible</span>
                      <strong>{user.credits || 0} créditos</strong>
                    </div>
                    <div className="credit-card">
                      <span>Reservado</span>
                      <strong>{user.pendingWithdrawalCredits || 0} créditos</strong>
                    </div>
                    <div className="credit-card">
                      <span>Pagado histórico</span>
                      <strong>{user.totalCreditsWithdrawn || 0} créditos</strong>
                    </div>
                  </div>

                  <div className="warning">
                    Guardá bien tus datos de cobro. El admin usará estos datos para transferirte el retiro.
                  </div>

                  <div className="form-stack">
                    <div className="form-group">
                      <label className="form-label">💎 Créditos a retirar</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        name="amount"
                        className="form-input"
                        value={withdrawalForm.amount}
                        onChange={handleWithdrawalFieldChange}
                        placeholder="Ej: 100"
                      />
                    </div>

                    <div className="compact-grid">
                      <div className="form-group">
                        <label className="form-label">👤 Titular</label>
                        <input
                          type="text"
                          name="accountHolder"
                          className="form-input"
                          value={withdrawalForm.accountHolder}
                          onChange={handleWithdrawalFieldChange}
                          placeholder="Nombre del titular"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">🏦 Banco</label>
                        <input
                          type="text"
                          name="bankName"
                          className="form-input"
                          value={withdrawalForm.bankName}
                          onChange={handleWithdrawalFieldChange}
                          placeholder="Banco o billetera"
                        />
                      </div>
                    </div>

                    <div className="compact-grid">
                      <div className="form-group">
                        <label className="form-label">🔑 Alias</label>
                        <input
                          type="text"
                          name="alias"
                          className="form-input"
                          value={withdrawalForm.alias}
                          onChange={handleWithdrawalFieldChange}
                          placeholder="tu.alias"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">🏛️ CBU</label>
                        <input
                          type="text"
                          name="cbu"
                          className="form-input"
                          value={withdrawalForm.cbu}
                          onChange={handleWithdrawalFieldChange}
                          placeholder="CBU"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">💳 CVU</label>
                      <input
                        type="text"
                        name="cvu"
                        className="form-input"
                        value={withdrawalForm.cvu}
                        onChange={handleWithdrawalFieldChange}
                        placeholder="CVU"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">📝 Nota para admin</label>
                      <textarea
                        name="requesterNote"
                        className="form-input form-textarea"
                        value={withdrawalForm.requesterNote}
                        onChange={handleWithdrawalFieldChange}
                        placeholder={'Podés dejar una aclaración.\nHorario de pago preferido\nCuenta principal\nCualquier dato útil'}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      disabled={submittingWithdrawal}
                      onClick={handleWithdrawalSubmit}
                    >
                      {submittingWithdrawal ? 'Enviando retiro...' : '🏧 Solicitar retiro'}
                    </button>
                  </div>
                </div>
              )}

              <ProfileInfoCard
                kicker="💫 About Me"
                title="Presentación"
                description="La parte central del perfil, para contar quién sos y qué vibe tiene tu room."
                items={aboutItems}
                emptyText="Todavía no agregaste contenido en About Me."
              />

              <ProfileInfoCard
                kicker="🎁 Wish List"
                title="Lista de deseos"
                description="Podés usarla para objetivos, regalos, metas o cosas que querés sumar a tu setup."
                items={wishlistItems}
                emptyText="Todavía no cargaste una wishlist."
              />

              <ProfileInfoCard
                kicker="💸 Tip Menu"
                title="Acciones y propinas"
                description="Mostrá una lista rápida de acciones, metas o reacciones asociadas a tips."
                items={tipMenuItems}
                emptyText="Todavía no cargaste un tip menu."
              />

              <ProfileInfoCard
                kicker="📏 Room Rules"
                title="Reglas del canal"
                description="Ideal para dejar claro cómo querés manejar el chat y la dinámica de la sala."
                items={rulesItems}
                emptyText="Todavía no definiste reglas para tu room."
              />

              <ProfileInfoCard
                kicker="🔗 Links"
                title="Links y redes"
                description="Podés pegar una red o link por línea para armar tu sección de links rápidos."
                items={socialItems}
                emptyText="Todavía no agregaste links o redes."
              />

              <div className="card profile-section-card">
                <span className="page-kicker">🖼️ Photo set</span>
                <h3>Galería del canal</h3>
                <p>
                  Estas fotos se muestran nítidas para vos en tu perfil y difuminadas para viewers cuando entren a tu room.
                </p>

                {galleryImages.length === 0 ? (
                  <div className="profile-empty-box">Todavía no subiste fotos para la galería.</div>
                ) : (
                  <div className="profile-gallery-grid">
                    {galleryImages.map((imageUrl) => (
                      <div key={imageUrl} className="profile-gallery-item">
                        <img src={imageUrl} alt="Foto de galería del perfil" className="profile-gallery-image" />
                        <button
                          type="button"
                          className="profile-gallery-remove"
                          onClick={() => handleRemoveGalleryImage(imageUrl)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <span className="page-kicker">🏦 Solicitudes de depósito</span>
              <h2>Compras de créditos por transferencia</h2>
              <p className="page-subtitle">
                Acá ves si tu comprobante sigue pendiente, fue aprobado o fue rechazado por admin.
              </p>

              {depositLoading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  Cargando solicitudes...
                </div>
              ) : depositRequests.length === 0 ? (
                <div className="warning">Todavía no enviaste ninguna solicitud de compra de créditos.</div>
              ) : (
                <div className="deposit-request-list">
                  {depositRequests.map((request) => (
                    <div key={request._id || request.id} className="transaction-item deposit-request-item">
                      <div className="transaction-copy">
                        <strong>{request.packName}</strong>
                        <span className="muted-text">
                          💸 ARS {request.amountArs?.toLocaleString('es-AR')} • 💎 {request.credits} créditos
                        </span>
                        <span className="muted-text">
                          👤 {request.payerName} • {formatDateTime(request.createdAt)}
                        </span>
                        {request.transferReference && (
                          <span className="muted-text">🔎 {request.transferReference}</span>
                        )}
                        <a href={request.proofImage} target="_blank" rel="noreferrer" className="inline-link">
                          Ver comprobante
                        </a>
                        {request.adminNote && (
                          <span className="muted-text">📝 {request.adminNote}</span>
                        )}
                      </div>

                      <span className={`info-chip deposit-status-chip deposit-status-${request.status}`}>
                        {depositStatusLabels[request.status] || request.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canRequestWithdrawals && (
              <div className="card">
                <span className="page-kicker">💸 Solicitudes de retiro</span>
                <h2>Pedidos para que el admin te pague</h2>
                <p className="page-subtitle">
                  Cuando pedís un retiro, los créditos bajan de tu saldo y quedan reservados hasta que el admin
                  lo marque como pagado o lo rechace.
                </p>

                {withdrawalLoading ? (
                  <div className="loading">
                    <div className="spinner"></div>
                    Cargando retiros...
                  </div>
                ) : withdrawalRequests.length === 0 ? (
                  <div className="warning">Todavía no enviaste ninguna solicitud de retiro.</div>
                ) : (
                  <div className="deposit-request-list">
                    {withdrawalRequests.map((request) => (
                      <div key={request._id || request.id} className="transaction-item deposit-request-item">
                        <div className="transaction-copy">
                          <strong>🏧 Retiro de {request.credits} créditos</strong>
                          <span className="muted-text">
                            👤 {request.accountHolder}
                            {request.bankName ? ` • ${request.bankName}` : ''}
                            {' • '}
                            {formatDateTime(request.createdAt)}
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
                          {request.requesterNote && (
                            <span className="muted-text">📝 {request.requesterNote}</span>
                          )}
                          {request.paymentReference && (
                            <span className="muted-text">🔎 Ref. pago: {request.paymentReference}</span>
                          )}
                          {request.adminNote && (
                            <span className="muted-text">⚙️ {request.adminNote}</span>
                          )}
                        </div>

                        <span className={`info-chip deposit-status-chip deposit-status-${request.status}`}>
                          {withdrawalStatusLabels[request.status] || request.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="card profile-editor-card">
              <span className="page-kicker">⚙️ Editor de perfil</span>
              <h2>Configurá tu performer page</h2>
              <p className="page-subtitle">
                Seguís pudiendo pegar URLs a mano, pero ahora también podés subir archivos directos
                para avatar, portada y galería.
              </p>

              <div className="upload-panel-grid">
                <div className="upload-field-card">
                  <label className="form-label">🖼️ Subir avatar</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="upload-input"
                    onChange={(e) => {
                      handleUpload('avatar', e.target.files);
                      e.target.value = '';
                    }}
                    disabled={uploading.avatar}
                  />
                  <p className="upload-helper">
                    {uploading.avatar ? 'Subiendo avatar...' : 'JPG, PNG, WEBP o GIF hasta 8MB'}
                  </p>
                </div>

                <div className="upload-field-card">
                  <label className="form-label">🎬 Subir portada</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="upload-input"
                    onChange={(e) => {
                      handleUpload('cover', e.target.files);
                      e.target.value = '';
                    }}
                    disabled={uploading.cover}
                  />
                  <p className="upload-helper">
                    {uploading.cover ? 'Subiendo portada...' : 'Ideal para el encabezado del perfil'}
                  </p>
                </div>

                <div className="upload-field-card upload-field-card-wide">
                  <label className="form-label">📸 Subir fotos a la galería</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="upload-input"
                    onChange={(e) => {
                      handleUpload('gallery', e.target.files);
                      e.target.value = '';
                    }}
                    disabled={uploading.gallery}
                  />
                  <p className="upload-helper">
                    {uploading.gallery
                      ? 'Subiendo fotos a la galería...'
                      : 'Podés subir varias fotos juntas. Máximo visible: 12'}
                  </p>
                </div>
              </div>

              <div className="form-stack">
                <div className="form-group">
                  <label className="form-label">👤 Nombre visible</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Tu nombre visible"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">✨ Headline corta</label>
                  <input
                    type="text"
                    name="bio"
                    className="form-input"
                    value={form.bio}
                    onChange={handleChange}
                    placeholder="Una línea corta que resuma tu room"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">🖼️ Avatar URL</label>
                  <input
                    type="url"
                    name="avatar"
                    className="form-input"
                    value={form.avatar}
                    onChange={handleChange}
                    placeholder="https://ejemplo.com/avatar.jpg"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">🎬 Portada URL</label>
                  <input
                    type="url"
                    name="coverImage"
                    className="form-input"
                    value={form.coverImage}
                    onChange={handleChange}
                    placeholder="https://ejemplo.com/cover.jpg"
                  />
                </div>

                {canRequestWithdrawals && (
                  <>
                    <div className="form-group">
                      <label className="form-label">👤 Titular para retiros</label>
                      <input
                        type="text"
                        name="payoutAccountHolder"
                        className="form-input"
                        value={form.payoutAccountHolder}
                        onChange={handleChange}
                        placeholder="Nombre del titular"
                      />
                    </div>

                    <div className="compact-grid">
                      <div className="form-group">
                        <label className="form-label">🏦 Banco para retiros</label>
                        <input
                          type="text"
                          name="payoutBankName"
                          className="form-input"
                          value={form.payoutBankName}
                          onChange={handleChange}
                          placeholder="Banco o billetera"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">🔑 Alias de cobro</label>
                        <input
                          type="text"
                          name="payoutAlias"
                          className="form-input"
                          value={form.payoutAlias}
                          onChange={handleChange}
                          placeholder="tu.alias"
                        />
                      </div>
                    </div>

                    <div className="compact-grid">
                      <div className="form-group">
                        <label className="form-label">🏛️ CBU</label>
                        <input
                          type="text"
                          name="payoutCbu"
                          className="form-input"
                          value={form.payoutCbu}
                          onChange={handleChange}
                          placeholder="CBU"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">💳 CVU</label>
                        <input
                          type="text"
                          name="payoutCvu"
                          className="form-input"
                          value={form.payoutCvu}
                          onChange={handleChange}
                          placeholder="CVU"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">💫 About Me</label>
                  <textarea
                    name="aboutMe"
                    className="form-input form-textarea"
                    value={form.aboutMe}
                    onChange={handleChange}
                    placeholder={'Una idea o línea por renglón.\nQuién sos.\nQué se ve en tu room.\nQué horarios manejás.'}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">🎁 Wish List</label>
                  <textarea
                    name="wishlist"
                    className="form-input form-textarea"
                    value={form.wishlist}
                    onChange={handleChange}
                    placeholder={'Un deseo por línea.\nLuces nuevas para el setup\nMicrófono mejor\nMeta especial del canal'}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">💸 Tip Menu</label>
                  <textarea
                    name="tipMenu"
                    className="form-input form-textarea"
                    value={form.tipMenu}
                    onChange={handleChange}
                    placeholder={'Una acción por línea.\n10 - saludo especial\n25 - canción elegida por chat\n50 - meta express'}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">📏 Room Rules</label>
                  <textarea
                    name="roomRules"
                    className="form-input form-textarea"
                    value={form.roomRules}
                    onChange={handleChange}
                    placeholder={'Una regla por línea.\nRespeto en el chat\nSin spam\nSin pedidos fuera de reglas'}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">🔗 Links y redes</label>
                  <textarea
                    name="socials"
                    className="form-input form-textarea"
                    value={form.socials}
                    onChange={handleChange}
                    placeholder={'Un link o red por línea.\nInstagram: https://...\nWishlist: https://...\nTelegram: @...'}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  className="btn btn-primary btn-block"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="spinner"></div>
                      Guardando...
                    </>
                  ) : (
                    '💾 Guardar perfil'
                  )}
                </button>

                {message && (
                  <div className={messageType === 'error' ? 'error' : 'success'}>
                    {message}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <span className="page-kicker">🧾 Historial</span>
              <h2>Movimientos de créditos</h2>
              <p className="page-subtitle">
                Todo lo que ganás y gastás dentro de la plataforma queda registrado acá.
              </p>

              {historyLoading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  Cargando historial...
                </div>
              ) : creditHistory.length === 0 ? (
                <div className="warning">Todavía no hay movimientos de créditos en tu cuenta.</div>
              ) : (
                <div className="transaction-list">
                  {creditHistory.map((transaction) => (
                    <div key={transaction._id || transaction.id} className="transaction-item">
                      <div className="transaction-copy">
                        <strong>
                          {transactionIcons[transaction.type] || '💠'} {transaction.description}
                        </strong>
                        <span className="muted-text">
                          {formatDateTime(transaction.createdAt)}
                          {transaction.referenceUser?.name ? ` • ${transaction.referenceUser.name}` : ''}
                          {typeof transaction.balanceAfter === 'number' ? ` • Saldo: ${transaction.balanceAfter}` : ''}
                        </span>
                      </div>
                      <span
                        className={`transaction-amount ${
                          transaction.direction === 'debit'
                            ? 'transaction-amount-debit'
                            : 'transaction-amount-credit'
                        }`}
                      >
                        {transaction.direction === 'debit' ? '-' : '+'}
                        {transaction.amount}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
