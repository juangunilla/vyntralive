'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import api from '../lib/api';
import { clearSession, getStoredUser, setStoredUser } from '../lib/session';

const getInitials = (name = '') => (
  name
    .split(' ')
    .map((part) => part?.[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CB'
);

export default function TopbarClient() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const syncUser = () => {
      const storedUser = getStoredUser();
      if (!storedUser) {
        setUser(null);
        return;
      }

      setUser(storedUser);

      api.get('/users/profile')
        .then((response) => {
          setStoredUser(response.data);
          setUser(response.data);
        })
        .catch(() => {
          clearSession();
          setUser(null);
        });
    };

    syncUser();
    window.addEventListener('session-updated', syncUser);
    return () => window.removeEventListener('session-updated', syncUser);
  }, [pathname]);

  const initials = useMemo(() => getInitials(user?.name), [user?.name]);

  const handleLogout = () => {
    clearSession();
    setUser(null);
    router.push('/login');
  };

  return (
    <div className="site-topbar-inner">
      <Link href="/" className="brand-lockup">
        <span className="brand-mark">
          <Image
            src="/logo.jpeg"
            alt="Logo de Vyntra Live"
            width={64}
            height={64}
            sizes="64px"
            priority
          />
        </span>
        <span className="brand-copy">
          <strong>Vyntra Live</strong>
          <small>Streaming en vivo</small>
        </span>
      </Link>

      <nav className="topbar-nav">
        <Link href="/streams" className="topbar-link">Salas</Link>
        {user && <Link href="/profile" className="topbar-link">Mi perfil</Link>}
        {user?.role === 'admin' && <Link href="/dashboard" className="topbar-link">Panel</Link>}
      </nav>

      {user ? (
        <div className="topbar-userbox">
          <Link href="/profile" className="topbar-usercard">
            <span className="topbar-avatar">
              {user.avatar ? (
                <img src={user.avatar} alt={`Avatar de ${user.name}`} />
              ) : (
                initials
              )}
            </span>
            <span className="topbar-usercopy">
              <strong>{user.name}</strong>
              <small>Mi perfil</small>
            </span>
          </Link>

          <button type="button" className="topbar-pill" onClick={handleLogout}>
            Salir
          </button>
        </div>
      ) : (
        <div className="topbar-actions">
          <Link href="/login" className="topbar-pill">Entrar</Link>
          <Link href="/register" className="btn btn-primary">Crear cuenta</Link>
        </div>
      )}
    </div>
  );
}
