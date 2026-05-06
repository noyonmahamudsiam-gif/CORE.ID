import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Navigate } from 'react-router-dom';

type AuthMode = 'login' | 'register' | 'verify-register' | 'forgot' | 'verify-reset' | 'reset-password';

export default function Auth() {
  const { user, login } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, identifier, password, gender, dateOfBirth })
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(data.message + (data.mockCode ? ` (Dev Code: ${data.mockCode})` : ''));
          setMode('verify-register');
          setOtp(data.mockCode || '');
        } else {
          setError(data.error);
        }
      } 
      else if (mode === 'verify-register') {
        const res = await fetch('/api/auth/verify-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, code: otp })
        });
        const data = await res.json();
        if (res.ok) {
          login(data.token, data.user);
        } else {
          setError(data.error);
        }
      }
      else if (mode === 'forgot') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier })
        });
        const data = await res.json();
        if (res.ok) {
          setSuccessMsg(data.message + (data.mockCode ? ` (Dev Code: ${data.mockCode})` : ''));
          setMode('verify-reset');
          setOtp(data.mockCode || '');
        } else {
          setError(data.error);
        }
      }
      else if (mode === 'verify-reset') {
        const res = await fetch('/api/auth/verify-reset-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, code: otp })
        });
        const data = await res.json();
        if (res.ok) {
          setResetToken(data.token);
          setMode('reset-password');
          setPassword('');
          setSuccessMsg('Code verified. Enter your new security key.');
        } else {
          setError(data.error);
        }
      }
      else if (mode === 'reset-password') {
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
          setError(data.error);
        }
      }
      else if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (res.ok) {
          login(data.token, data.user);
        } else {
          setError(data.error || 'Authentication failed');
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentTitle = {
    'login': 'SYSTEM LOGIN',
    'register': 'INITIALIZE ID',
    'verify-register': 'VERIFY EMAIL',
    'forgot': 'REQUEST RESET',
    'verify-reset': 'VERIFY RESET CODE',
    'reset-password': 'SET NEW KEY'
  }[mode];

  const currentButton = {
    'login': 'ACCESS SYSTEM',
    'register': 'CREATE PROTOCOL',
    'verify-register': 'VERIFY AND ENTER',
    'forgot': 'SEND RESET CODE',
    'verify-reset': 'VERIFY CODE',
    'reset-password': 'CONFIRM NEW KEY'
  }[mode];

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 text-white">
      <div className="max-w-md w-full glass rounded-3xl p-8">
        <div className="flex justify-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter">
            CORE.<span className="text-blue-500">ID</span>
          </h1>
        </div>
        
        <h2 className="text-3xl font-black text-center mb-8 pt-2 leading-tight uppercase tracking-tighter">
          {currentTitle}
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
                required 
              />
            </div>
          )}
          
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Comms Address (Email/Phone)</label>
              <input 
                type="text" 
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold placeholder:text-white/20"
                placeholder="EMAIL OR PHONE"
                required 
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Gender</label>
                <select 
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-4 rounded-full bg-black/50 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold appearance-none"
                  required
                >
                  <option value="Prefer not to say">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">Date of Birth</label>
                <input 
                  type="date" 
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold"
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}

          {(mode === 'verify-register' || mode === 'verify-reset') && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-2">4-Digit Verification Code</label>
              <input 
                type="text" 
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-4 rounded-full bg-white/5 border border-white/10 focus:border-blue-500 transition-colors outline-none text-white font-bold text-center tracking-[1em] placeholder:text-white/20 placeholder:tracking-normal"
                placeholder="0000"
                maxLength={4}
                required 
              />
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'reset-password') && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  {mode === 'reset-password' ? 'New Security Key' : 'Security Key'}
                </label>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }}
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
                placeholder="PASSWORD (MIN 6 CHARS)"
                minLength={6}
                required 
              />
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading}
            className={`w-full bg-blue-500 text-white font-black uppercase tracking-tighter py-4 px-4 rounded-full transition-colors flex justify-center items-center ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white hover:text-black'}`}
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : currentButton}
          </button>
        </form>

        <p className="mt-8 text-center text-xs font-bold uppercase tracking-widest text-white/40">
           {(mode === 'login' || mode === 'forgot' || mode === 'verify-reset' || mode === 'reset-password') ? "NEW TO CORE.ID? " : "ALREADY REGISTERED? "}
           <button 
             type="button"
             disabled={loading}
             onClick={() => { 
               setMode(
                 (mode === 'login' || mode === 'forgot' || mode === 'verify-reset' || mode === 'reset-password') ? 'register' : 'login'
               ); 
               setError(''); 
               setSuccessMsg(''); 
             }} 
             className="text-blue-500 hover:text-white transition-colors ml-2"
           >
             {(mode === 'login' || mode === 'forgot' || mode === 'verify-reset' || mode === 'reset-password') ? 'INITIALIZE' : 'LOGIN'}
           </button>
        </p>

        {(mode === 'verify-register' || mode === 'verify-reset') && (
           <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-white/40">
             Didn't receive code?&nbsp;
             <button 
               type="button"
               disabled={loading}
               onClick={() => {
                 setMode(mode === 'verify-register' ? 'register' : 'forgot');
                 setError('');
                 setSuccessMsg('');
                 setOtp('');
               }} 
               className="text-blue-500 hover:text-white transition-colors"
             >
               Go Back & Resend
             </button>
           </p>
        )}
      </div>
    </div>
  );
}
