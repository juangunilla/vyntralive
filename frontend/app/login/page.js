'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';
import { setSession } from '../../lib/session';

const perks = [
  {
    icon: '📺',
    title: 'Tus vivos a mano',
    description: 'Entrá y retomá transmisiones, comunidad y panel sin perder tiempo.',
  },
  {
    icon: '💬',
    title: 'Chat prendido',
    description: 'Respondé al instante y mantené el ambiente del stream bien arriba.',
  },
  {
    icon: '⚡',
    title: 'Acceso rápido',
    description: 'Un login y ya estás listo para volver a salir al aire.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState('');

  useEffect(() => {
    setReturnTo(new URLSearchParams(window.location.search).get('returnTo') || '');
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', form);
      setSession(response.data);
      router.push(returnTo || '/streams');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-copy">
        <span className="eyebrow">🔐 Entrá al backstage</span>
        <h1>Volvé al stream con toda la energía ⚡</h1>
        <p className="hero-text">
          Iniciá sesión para recuperar tu perfil, entrar a las transmisiones activas y seguir
          la conversación sin perder el ritmo y usar tus créditos dentro de la plataforma.
        </p>

        <div className="support-panel">
          {perks.map((perk) => (
            <div key={perk.title} className="support-item">
              <div className="feature-icon">{perk.icon}</div>
              <div className="stack-sm">
                <strong>{perk.title}</strong>
                <p>{perk.description}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="muted-text">
          ¿No tienes cuenta?{' '}
          <Link href="/register" className="inline-link">
            Regístrate aquí ✨
          </Link>
        </p>
      </section>

      <div className="main-content auth-card">
        <span className="page-kicker">👋 Bienvenido de nuevo</span>
        <h2>Todo listo para volver al aire</h2>
        <p className="page-subtitle">
          Completá tus datos y entrá directo a la plataforma.
        </p>

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label className="form-label">📧 Email</label>
            <input
              type="email"
              name="email"
              className="form-input"
              placeholder="tu@email.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">🔒 Contraseña</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="Tu contraseña"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Iniciando sesión...
              </>
            ) : (
              '🚀 Iniciar Sesión'
            )}
          </button>

          {error && <div className="error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
