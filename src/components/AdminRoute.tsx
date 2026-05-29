'use client';

import { useState, useEffect } from 'react';

// Keys for storing the session token
const ADMIN_TOKEN_KEY = 'admin_token';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Setup fields (for creating the first admin)
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
      // Verify the token is still valid
      fetch('/api/admin/auth', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.ok && json.data?.valid) {
            setAuthenticated(true);
          } else {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            setShowLogin(true);
          }
        })
        .catch(() => {
          setShowLogin(true);
        })
        .finally(() => setLoading(false));
    } else {
      // No token — check if any admin exists in DB
      fetch('/api/admin/users?pageSize=1&role=admin')
        .then((res) => res.json())
        .then((json) => {
          if (json.ok && json.data?.total > 0) {
            setShowLogin(true);
          } else {
            setShowSetup(true);
          }
        })
        .catch(() => setShowSetup(true))
        .finally(() => setLoading(false));
    }
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!setupEmail || !setupPassword || !setupName) {
      setError('Please fill in all fields');
      return;
    }
    if (setupPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setError('Passwords do not match');
      return;
    }

    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: setupEmail, password: setupPassword, name: setupName }),
      });
      const json = await res.json();

      if (json.ok) {
        // Auto-login after setup
        const loginRes = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: setupEmail, password: setupPassword }),
        });
        const loginJson = await loginRes.json();
        if (loginJson.ok && loginJson.data?.token) {
          sessionStorage.setItem(ADMIN_TOKEN_KEY, loginJson.data.token);
          setAuthenticated(true);
          setShowSetup(false);
        } else {
          setError('Admin created, but auto-login failed. Please refresh and log in.');
        }
      } else {
        setError(json.error || 'Failed to create admin');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter email and password');
      return;
    }

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();

      if (json.ok && json.data?.token) {
        sessionStorage.setItem(ADMIN_TOKEN_KEY, json.data.token);
        setAuthenticated(true);
        setShowLogin(false);
      } else {
        setError(json.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Failed to connect to server');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setAuthenticated(false);
    setShowLogin(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent-gold border-t-transparent" />
      </div>
    );
  }

  if (authenticated) {
    return (
      <>
        {children}
        <button
          onClick={handleLogout}
          className="fixed bottom-4 right-4 z-50 px-3 py-1.5 text-[10px] rounded-lg bg-white/5 border border-white/10 text-foreground-secondary hover:text-white hover:bg-white/10 transition-all opacity-30 hover:opacity-100"
        >
          Logout
        </button>
      </>
    );
  }

  // === SETUP SCREEN (no admin exists in DB yet) ===
  if (showSetup) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="glass-lg rounded-2xl border border-white/10 p-8 w-full max-w-md animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-2xl font-bold text-black mb-4 shadow-lg shadow-accent-gold/20">
              S
            </div>
            <h1 className="text-2xl font-serif text-white mb-1">First-Time Admin Setup</h1>
            <p className="text-foreground-secondary text-sm">Create the admin account in the database</p>
          </div>

          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="block text-sm text-foreground-secondary mb-1.5">Name</label>
              <input type="text" value={setupName} onChange={(e) => setSetupName(e.target.value)} placeholder="e.g. Admin" className="w-full py-2.5 px-4 text-sm" autoFocus />
            </div>
            <div>
              <label className="block text-sm text-foreground-secondary mb-1.5">Email (login username)</label>
              <input type="email" value={setupEmail} onChange={(e) => setSetupEmail(e.target.value)} placeholder="e.g. admin@example.com" className="w-full py-2.5 px-4 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-foreground-secondary mb-1.5">Password</label>
              <input type="password" value={setupPassword} onChange={(e) => setSetupPassword(e.target.value)} placeholder="Min 4 characters" className="w-full py-2.5 px-4 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-foreground-secondary mb-1.5">Confirm Password</label>
              <input type="password" value={setupConfirm} onChange={(e) => setSetupConfirm(e.target.value)} placeholder="Re-enter password" className="w-full py-2.5 px-4 text-sm" />
            </div>

            {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>}

            <button type="submit" className="w-full py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all mt-2">
              Create Admin & Enter →
            </button>
          </form>
        </div>
      </div>
    );
  }

  // === LOGIN SCREEN ===
  if (showLogin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="glass-lg rounded-2xl border border-white/10 p-8 w-full max-w-md animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-2xl font-bold text-black mb-4 shadow-lg shadow-accent-gold/20">
              S
            </div>
            <h1 className="text-2xl font-serif text-white mb-1">Admin Access</h1>
            <p className="text-foreground-secondary text-sm">Enter your admin email and password</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-foreground-secondary mb-1.5">Email / Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your admin email" className="w-full py-2.5 px-4 text-sm" autoFocus />
            </div>
            <div>
              <label className="block text-sm text-foreground-secondary mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your admin password" className="w-full py-2.5 px-4 text-sm" />
            </div>

            {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>}

            <button type="submit" className="w-full py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-accent-gold to-accent-gold-light text-black hover:shadow-xl hover:shadow-accent-gold/40 transition-all mt-2">
              Unlock Admin →
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}