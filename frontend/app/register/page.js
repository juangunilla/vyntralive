'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';
import { setSession } from '../../lib/session';

const perks = [
  {
    icon: '🎬',
    title: 'Armá tu identidad',
    description: 'Definí tu perfil y dejá tu canal presentable desde el minuto uno.',
  },
  {
    icon: '📡',
    title: 'Transmití a tu manera',
    description: 'Elegí entre navegador u OBS según el nivel de producción que busques.',
  },
  {
    icon: '🥳',
    title: 'Entrá con estilo',
    description: 'Más personalidad visual y una experiencia más divertida desde el registro.',
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/register', form);
      setSession(response.data);
      router.push('/streams');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <section className="auth-copy">
        <span className="eyebrow">✨ Primer paso para salir al aire</span>
        <h1>Creá tu cuenta y entrá con toda la facha 🎉</h1>
        <p className="hero-text">
          Registrate, elegí tu rol y dejá listo tu espacio para mirar, charlar o transmitir
          sin perder tiempo en configuraciones raras. Además arrancás con créditos de bienvenida
          para apoyar a otros creadores.
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
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="inline-link">
            Inicia sesión aquí 🔐
          </Link>
        </p>
      </section>

      <div className="main-content auth-card">
        <span className="page-kicker">🚀 Alta rápida</span>
        <h2>Tu canal empieza acá</h2>
        <p className="page-subtitle">
          Completá los datos básicos y entrá en segundos.
        </p>

        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-group">
            <label className="form-label">👤 Nombre</label>
            <input
              type="text"
              name="name"
              className="form-input"
              placeholder="Tu nombre completo"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

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
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">🎭 Tipo de cuenta</label>
            <select name="role" className="form-input" value={form.role} onChange={handleChange}>
              <option value="user">👥 Usuario Normal</option>
              <option value="creator">🎬 Creador de Contenido</option>
            </select>
          </div>

          <button type="submit" className="btn btn-success btn-block" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                Creando cuenta...
              </>
            ) : (
              '🚀 Crear Cuenta'
            )}
          </button>

          {error && <div className="error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
