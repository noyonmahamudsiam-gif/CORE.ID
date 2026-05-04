import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Navigate } from 'react-router-dom';

export default function Auth() {
  const { user, login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };
    
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
          {isLogin ? 'SYSTEM LOGIN' : 'INITIALIZE ID'}
        </h2>

        {error && (
          <div className="bg-red-500/20 text-red-500 p-4 rounded-3xl mb-6 text-sm font-bold border border-red-500/50 uppercase tracking-widest text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Identifier</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold placeholder:text-white/20"
                placeholder="DISPLAY NAME"
                required 
              />
            </div>
          )}
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
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Security Key</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold placeholder:text-white/20"
              placeholder="PASSWORD"
              required 
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-blue-500 text-white font-black uppercase tracking-tighter py-4 px-4 rounded-full hover:bg-white hover:text-black transition-colors"
          >
            {isLogin ? 'ACCESS SYSTEM' : 'CREATE PROTOCOL'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs font-bold uppercase tracking-widest text-white/40">
          {isLogin ? "NEW TO CORE.ID? " : "ALREADY REGISTERED? "}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-blue-500 hover:text-white transition-colors ml-2"
          >
            {isLogin ? 'INITIALIZE' : 'LOGIN'}
          </button>
        </p>
      </div>
    </div>
  );
}
