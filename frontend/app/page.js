import Link from 'next/link';

const spotlightRooms = [
  {
    title: 'Late Night Lobby',
    host: 'Nina Live',
    viewers: 1842,
    note: 'Chat prendido y room con mucha actividad.',
  },
  {
    title: 'Studio Vibes',
    host: 'Axel Room',
    viewers: 963,
    note: 'Formato limpio, cámara full y propinas activas.',
  },
  {
    title: 'After Hours Set',
    host: 'Mika On Air',
    viewers: 731,
    note: 'Directo constante con comunidad muy presente.',
  },
];

const categoryPills = [
  '🔴 En vivo',
  '💬 Chat activo',
  '💎 Tips',
  '🎛️ OBS',
  '📱 Mobile ready',
  '⚡ Entrada rápida',
];

const quickLinks = [
  {
    href: '/streams',
    label: 'Explorar salas',
    icon: '📺',
    description: 'Entrá directo al directorio live y filtrá por rooms activas.',
  },
  {
    href: '/register',
    label: 'Abrir cuenta',
    icon: '✨',
    description: 'Sumate como fan o creador y activá tu perfil en segundos.',
  },
  {
    href: '/profile',
    label: 'Configurar perfil',
    icon: '🧷',
    description: 'Bio, avatar y presencia de room para que tu canal tenga identidad.',
  },
  {
    href: '/dashboard',
    label: 'Ver panel',
    icon: '📊',
    description: 'Usuarios, streams y actividad desde una vista más operativa.',
  },
];

const platformNotes = [
  {
    icon: '🎥',
    title: 'Stage protagonista',
    description: 'La sala prioriza video, estado live y acceso rápido al room sin vueltas.',
  },
  {
    icon: '💬',
    title: 'Sidebar de chat',
    description: 'Panel lateral compacto para mensajes, tips y datos del canal.',
  },
  {
    icon: '🧭',
    title: 'Directorio tipo cam-site',
    description: 'Más foco en cards, rooms activas, badges y navegación visual inmediata.',
  },
];

const stats = [
  { label: 'Rooms activas', value: '24/7' },
  { label: 'Chat + tips', value: 'ON' },
  { label: 'Look & feel', value: 'Live' },
];

export default function HomePage() {
  return (
    <div className="app-container">
      <div className="main-content home-page">
        <section className="cam-hero">
          <div className="cam-hero-copy">
            <span className="eyebrow">🔴 Directorio de rooms en vivo</span>
            <h1>Más estética de cam platform, menos landing genérica.</h1>
            <p className="hero-text">
              La interfaz ahora apunta a salas, viewers, propinas y chat como protagonistas.
              Todo más oscuro, más directo y más cerca de una experiencia tipo directorio live.
            </p>

            <div className="hero-actions">
              <Link href="/streams" className="btn btn-primary">
                📺 Entrar al directorio
              </Link>
              <Link href="/register" className="btn btn-secondary">
                ✨ Crear perfil
              </Link>
            </div>

            <div className="hero-stats">
              {stats.map((stat) => (
                <div key={stat.label} className="stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
          </div>

          <aside className="cam-hero-side">
            <div className="hero-directory-card">
              <div className="section-heading">
                <div>
                  <span className="page-kicker">🔥 Spotlight</span>
                  <h2>Rooms destacadas ahora</h2>
                </div>
              </div>

              <div className="mini-live-list">
                {spotlightRooms.map((room) => (
                  <div key={room.title} className="mini-live-card">
                    <div className="mini-live-header">
                      <span className="status status-live">🔴 live</span>
                      <span className="info-chip">👥 {room.viewers}</span>
                    </div>
                    <strong>{room.title}</strong>
                    <p>{room.note}</p>
                    <span className="mini-live-host">por {room.host}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-directory-card accent-card">
              <span className="page-kicker">🧷 Tags del sitio</span>
              <h3>Un look más de sala y descubrimiento</h3>
              <div className="category-chip-row">
                {categoryPills.map((pill) => (
                  <span key={pill} className="category-chip">{pill}</span>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="page-kicker">📡 Estructura nueva</span>
              <h2>Qué cambió para acercarlo a una vibe tipo cam-site</h2>
            </div>
            <p className="page-subtitle">
              Más jerarquía para el video, directorio visual, chips de estado y paneles compactos.
            </p>
          </div>

          <div className="grid grid-3">
            {platformNotes.map((note) => (
              <div key={note.title} className="card feature-card">
                <div className="feature-icon">{note.icon}</div>
                <h3>{note.title}</h3>
                <p>{note.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="page-kicker">🚪 Entradas rápidas</span>
              <h2>Movete por la plataforma como si fuera un directorio live</h2>
            </div>
          </div>

          <div className="quick-links-grid">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="quick-link">
                <div className="feature-icon">{link.icon}</div>
                <div className="stack-sm">
                  <strong>{link.label}</strong>
                  <p>{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
