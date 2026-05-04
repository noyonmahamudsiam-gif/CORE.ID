import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Navigate } from 'react-router-dom';

export default function Auth() {
  const { user, login } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (user) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'forgot') {
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(`Requested reset for ${email}. Token: ${data.token}`);
          setMode('reset');
        } else {
          setError(data.error || 'Failed to request reset');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      }
      return;
    }

    if (mode === 'reset') {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: resetToken, password })
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg('Password reset successful. You can now login.');
          setMode('login');
          setPassword('');
        } else {
          setError(data.error || 'Failed to reset password');
        }
      } catch (err) {
        setError('Network error. Please try again.');
      }
      return;
    }

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login' ? { email, password } : { name, email, password };
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 text-white">
      <div className="max-w-md w-full glass rounded-3xl p-8">
        <div className="flex justify-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter">
            CORE.<span className="text-blue-500">ID</span>
          </h1>
        </div>
        
        <h2 className="text-3xl font-black text-center mb-8 pt-2 leading-tight uppercase tracking-tighter">
          {mode === 'login' && 'SYSTEM LOGIN'}
          {mode === 'register' && 'INITIALIZE ID'}
          {mode === 'forgot' && 'REQUEST RESET'}
          {mode === 'reset' && 'SET NEW KEY'}
        </h2>

        {successMsg && (
          <div className="bg-green-500/20 text-green-500 p-4 rounded-3xl mb-6 text-sm font-bold border border-green-500/50 tracking-wide text-center">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 text-red-500 p-4 rounded-3xl mb-6 text-sm font-bold border border-red-500/50 uppercase tracking-widest text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Identifier</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold placeholder:text-white/20"
                placeholder="DISPLAY NAME"
                required={mode === 'register'} 
              />
            </div>
          )}
          
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Comms Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold placeholder:text-white/20"
                placeholder="EMAIL"
                required 
              />
            </div>
          )}

          {mode === 'reset' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Reset Token</label>
              <input 
                type="text" 
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold placeholder:text-white/20"
                placeholder="TOKEN"
                required 
              />
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset') && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  {mode === 'reset' ? 'New Security Key' : 'Security Key'}
                </label>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => setMode('forgot')}
                    className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-500 hover:text-white transition-colors"
                  >
                    Forgot Key?
                  </button>
                )}
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold placeholder:text-white/20"
                placeholder="PASSWORD"
                required 
              />
            </div>
          )}
          
          <button 
            type="submit" 
            className="w-full bg-blue-500 text-white font-black uppercase tracking-tighter py-4 px-4 rounded-full hover:bg-white hover:text-black transition-colors"
          >
            {mode === 'login' && 'ACCESS SYSTEM'}
            {mode === 'register' && 'CREATE PROTOCOL'}
            {mode === 'forgot' && 'REQUEST RESET'}
            {mode === 'reset' && 'CONFIRM NEW KEY'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs font-bold uppercase tracking-widest text-white/40">
          {(mode === 'login' || mode === 'forgot' || mode === 'reset') ? "NEW TO CORE.ID? " : "ALREADY REGISTERED? "}
          <button 
            onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); setSuccessMsg(''); }} 
            className="text-blue-500 hover:text-white transition-colors ml-2"
          >
            {(mode === 'login' || mode === 'forgot' || mode === 'reset') ? 'INITIALIZE' : 'LOGIN'}
          </button>
        </p>
      </div>
    </div>
  );
}
