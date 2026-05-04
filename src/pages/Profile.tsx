import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';

export default function Profile() {
  const { user, token } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);

  const fetchBlockedUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/blocks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setBlockedUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [token]);

  const handleUnblock = async (blockedId: string) => {
    if (!token) return;
    try {
      await fetch(`/api/users/${blockedId}/block`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBlockedUsers();
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <div className="flex justify-center w-full min-h-full">
      <div className="w-full max-w-4xl px-4 py-8">
        <header className="flex justify-between items-start mb-12">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400 font-bold">User Identity</p>
            <h2 className="text-6xl md:text-8xl font-black leading-[0.8] tracking-tighter">PROFILE<br/>ACCESS.</h2>
          </div>
        </header>

        <div className="glass rounded-[3rem] overflow-hidden">
          <div className="h-64 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 opacity-80"></div>
          <div className="px-8 md:px-16 pb-16 relative">
            <div className="w-40 h-40 rounded-full p-2 absolute -top-20 glass bg-black/50">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-6xl font-black shadow-inner shadow-black/50 text-white">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
            
            <div className="pt-28">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                  <h1 className="text-5xl font-black tracking-tighter uppercase">{user.name}</h1>
                  <p className="text-sm uppercase tracking-[0.2em] text-white/40 mt-2 font-bold">{user.email}</p>
                </div>
                <button className="bg-white text-black px-8 py-4 rounded-full font-black uppercase tracking-tighter hover:bg-blue-500 hover:text-white transition-colors text-sm w-fit">
                  EDIT PROTOCOL
                </button>
              </div>
              
              <div className="mt-12 border-t border-white/10 pt-12">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 mb-6">About Entity</h2>
                <p className="text-xl md:text-3xl font-bold leading-tight tracking-tight text-white/80">
                  {user.bio || "NO SUPPLEMENTAL DATA PROVIDED. ENTITY PREFERS TO REMAIN ENCRYPTED."}
                </p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                <div className="glass rounded-3xl p-6 text-center">
                  <p className="text-4xl font-black mb-1">0</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Connections</p>
                </div>
                <div className="glass rounded-3xl p-6 text-center">
                  <p className="text-4xl font-black mb-1">0</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Transmissions</p>
                </div>
              </div>

              <div className="mt-12 border-t border-white/10 pt-12">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-red-500 mb-6">Restricted Entities</h2>
                {blockedUsers.length === 0 ? (
                  <p className="text-white/40 font-bold uppercase tracking-widest text-xs">NO RESTRICTED ENTITIES DETECTED.</p>
                ) : (
                  <div className="space-y-4">
                    {blockedUsers.map(u => (
                      <div key={u.id} className="glass rounded-2xl p-4 flex justify-between items-center bg-red-500/5 border-red-500/20">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold uppercase tracking-widest">{u.name}</span>
                        </div>
                        <button 
                          onClick={() => handleUnblock(u.id)} 
                          className="bg-red-500 hover:bg-white hover:text-red-500 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-colors"
                        >
                          RESTORE ACCESS
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
