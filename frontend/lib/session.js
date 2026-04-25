export const getStoredUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem('user') || 'null');
  } catch (error) {
    return null;
  }
};

export const setStoredUser = (user) => {
  if (typeof window === 'undefined' || !user) {
    return;
  }

  window.localStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new Event('session-updated'));
};

export const setSession = ({ token, user }) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    window.localStorage.setItem('token', token);
  }

  if (user) {
    setStoredUser(user);
    return;
  }

  window.dispatchEvent(new Event('session-updated'));
};

export const clearSession = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem('token');
  window.localStorage.removeItem('user');
  window.dispatchEvent(new Event('session-updated'));
};
