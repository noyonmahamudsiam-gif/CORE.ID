import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';

export default function Profile() {
  const { user, token, setUser } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editShowEmail, setEditShowEmail] = useState(false);
  const [editShowPhone, setEditShowPhone] = useState(false);
  const [editInterests, setEditInterests] = useState('');
  const [editBio, setEditBio] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditUsername(user.username || '');
      setEditEmail(user.email || '');
      setEditPhone(user.phone || '');
      setEditShowEmail(user.showEmail || false);
      setEditShowPhone(user.showPhone || false);
      setEditInterests((user.interests || []).join(', '));
      setEditBio(user.bio || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!token) return;
    setErrorMsg('');
    try {
      const payload = { 
        name: editName, 
        username: editUsername, 
        email: editEmail, 
        phone: editPhone, 
        showEmail: editShowEmail, 
        showPhone: editShowPhone, 
        bio: editBio,
        interests: editInterests.split(',').map(s => s.trim()).filter(Boolean)
      };
      
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setIsEditing(false);
      } else {
        setErrorMsg(data.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Please try again.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result;
      try {
        const res = await fetch('/api/users/me', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ avatar: base64 })
        });
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
        }
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'profile'|'network'>('profile');

  useEffect(() => {
    if (token) {
      fetchNetworkData();
    }
  }, [token]);

  const fetchNetworkData = async () => {
    if (!token) return;
    try {
      const [sugRes, reqRes, friRes] = await Promise.all([
        fetch('/api/friends/suggestions', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/friends/requests', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setSuggestions(await sugRes.json());
      setRequests(await reqRes.json());
      setFriends(await friRes.json());
    } catch (e) { console.error(e); }
  };

  const handleSendRequest = async (toId: string) => {
    if (!token) return;
    try {
      await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toId })
      });
      fetchNetworkData();
    } catch (e) { console.error(e); }
  };

  const handleAcceptRequest = async (fromId: string) => {
    if (!token) return;
    try {
      await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromId })
      });
      fetchNetworkData();
    } catch (e) { console.error(e); }
  };

  const handleRejectRequest = async (fromId: string) => {
    if (!token) return;
    try {
      await fetch('/api/friends/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fromId })
      });
      fetchNetworkData();
    } catch (e) { console.error(e); }
  };

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
        <header className="flex justify-between items-end mb-12">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400 font-bold">User Identity</p>
            <h2 className="text-6xl md:text-8xl font-black leading-[0.8] tracking-tighter">PROFILE<br/>ACCESS.</h2>
          </div>
          <div className="flex bg-white/5 rounded-full p-1 border border-white/10 hidden md:flex">
             <button onClick={() => setActiveTab('profile')} className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'profile' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white'}`}>Identity</button>
             <button onClick={() => setActiveTab('network')} className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'network' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white'}`}>Network</button>
          </div>
        </header>
        
        <div className="flex bg-white/5 rounded-full p-1 border border-white/10 mb-8 flex md:hidden">
             <button onClick={() => setActiveTab('profile')} className={`flex-1 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'profile' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white'}`}>Identity</button>
             <button onClick={() => setActiveTab('network')} className={`flex-1 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-colors relative ${activeTab === 'network' ? 'bg-blue-500 text-white' : 'text-white/40 hover:text-white'}`}>
                Network
                {requests.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
             </button>
        </div>

        {activeTab === 'profile' && (
        <div className="glass rounded-[3rem] overflow-hidden">
          <div className="h-64 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 opacity-80"></div>
          <div className="px-8 md:px-16 pb-16 relative">
            <div 
              className="w-40 h-40 rounded-full p-2 absolute -top-20 glass bg-black/50 cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
              title="Change Profile Picture"
            >
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-6xl font-black shadow-inner shadow-black/50 text-white overflow-hidden relative">
                {user.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
                <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-sm font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-all text-center px-4">
                  UPDATE IMAGE
                </div>
              </div>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            
            <div className="pt-28">
              {errorMsg && (
                <div className="bg-red-500/20 text-red-500 p-4 rounded-3xl mb-6 text-sm font-bold border border-red-500/50 uppercase tracking-widest text-center">
                  {errorMsg}
                </div>
              )}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                <div className="w-full space-y-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 block mb-1">Display Name</label>
                        <input 
                          type="text" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-3xl md:text-5xl font-black tracking-tighter uppercase w-full bg-transparent border-b-2 border-white/10 outline-none pb-2 text-white placeholder:text-white/20 focus:border-blue-500 transition-colors"
                          placeholder="DISPLAY NAME"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 block mb-1">Username (Unique)</label>
                        <input 
                          type="text" 
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                          className="text-xl md:text-2xl font-bold tracking-tighter w-full bg-transparent border-b-2 border-white/10 outline-none pb-2 text-white placeholder:text-white/20 focus:border-blue-500 transition-colors"
                          placeholder="@username"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 block mb-1">Email Address</label>
                          <input 
                            type="email" 
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            className="text-sm font-bold tracking-wide w-full glass bg-white/5 px-4 py-3 rounded-xl border border-white/10 outline-none text-white focus:border-blue-500"
                            placeholder="email@example.com"
                          />
                          <label className="flex items-center gap-2 mt-2 text-xs font-bold text-white/60 cursor-pointer">
                            <input type="checkbox" checked={editShowEmail} onChange={(e) => setEditShowEmail(e.target.checked)} className="rounded border-white/20" />
                            Show Email on Profile
                          </label>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 block mb-1">Contact Number</label>
                          <input 
                            type="tel" 
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="text-sm font-bold tracking-wide w-full glass bg-white/5 px-4 py-3 rounded-xl border border-white/10 outline-none text-white focus:border-blue-500"
                            placeholder="+1 234 567 890"
                          />
                          <label className="flex items-center gap-2 mt-2 text-xs font-bold text-white/60 cursor-pointer">
                            <input type="checkbox" checked={editShowPhone} onChange={(e) => setEditShowPhone(e.target.checked)} className="rounded border-white/20" />
                            Show Number on Profile
                          </label>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-5xl font-black tracking-tighter uppercase">{user.name}</h1>
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                         <span className="text-sm uppercase tracking-widest text-blue-400 font-bold bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">{user.username}</span>
                         {user.showEmail && <span className="text-sm tracking-wide text-white/60 font-bold glass px-3 py-1 rounded-full">{user.email}</span>}
                         {user.showPhone && user.phone && <span className="text-sm tracking-wide text-white/60 font-bold glass px-3 py-1 rounded-full">{user.phone}</span>}
                      </div>
                    </>
                  )}
                </div>
                <div className="shrink-0 flex gap-4 mt-4 md:mt-0">
                  {isEditing ? (
                    <>
                      <button onClick={() => setIsEditing(false)} className="text-white/60 hover:text-white px-4 py-4 rounded-full font-black uppercase tracking-tighter transition-colors text-sm w-fit">
                        CANCEL
                      </button>
                      <button onClick={handleSaveProfile} className="bg-blue-500 text-white px-8 py-4 rounded-full font-black uppercase tracking-tighter hover:bg-white hover:text-black transition-colors text-sm w-fit shadow-lg shadow-blue-500/20">
                        SAVE PROTOCOL
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setIsEditing(true)} className="bg-white text-black px-8 py-4 rounded-full font-black uppercase tracking-tighter hover:bg-blue-500 hover:text-white transition-colors text-sm w-fit shadow-lg shadow-white/10">
                      EDIT PROTOCOL
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mt-12 border-t border-white/10 pt-12 text-left">
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white/40 mb-6">About Entity & Interests</h2>
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 block mb-1">Interests (Comma separated)</label>
                      <input 
                        type="text" 
                        value={editInterests}
                        onChange={(e) => setEditInterests(e.target.value)}
                        className="text-sm font-bold tracking-wide w-full glass bg-white/5 px-4 py-3 rounded-xl border border-white/10 outline-none text-white focus:border-blue-500"
                        placeholder="React, Design, AI, Gaming..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold tracking-widest text-white/40 block mb-1">Bio</label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value.substring(0, 160))}
                        className="w-full bg-black/20 glass p-6 rounded-3xl outline-none text-xl md:text-2xl font-bold leading-tight tracking-tight text-white border focus:border-blue-500 transition-colors resize-none placeholder:text-white/20"
                        placeholder="ENTER SUPPLEMENTAL DATA..."
                        rows={4}
                        maxLength={160}
                      />
                      <div className="text-right text-xs font-bold uppercase tracking-widest text-white/40 mt-2">
                        {editBio.length} / 160 CHARACTERS
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <p className="text-xl md:text-3xl font-bold leading-tight tracking-tight text-white/80 whitespace-pre-wrap">
                      {user.bio || "NO SUPPLEMENTAL DATA PROVIDED. ENTITY PREFERS TO REMAIN ENCRYPTED."}
                    </p>
                    {user.interests && user.interests.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {user.interests.map((interest: string, i: number) => (
                          <span key={i} className="text-xs font-bold uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-full border border-white/20 text-white truncate">
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                <div className="glass rounded-3xl p-6 text-center">
                  <p className="text-4xl font-black mb-1">{friends.length}</p>
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
                          <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center font-bold overflow-hidden shrink-0">
                            {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
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
        )}

        {activeTab === 'network' && (
          <div className="space-y-8 glass rounded-[3rem] p-8 md:p-12">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter mb-4 text-blue-500">Incoming Requests</h2>
              {requests.length === 0 ? (
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">NO PENDING REQUESTS.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {requests.map(req => (
                    <div key={req.fromId} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center justify-between">
                       <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold overflow-hidden shrink-0">
                           {req.avatar ? <img src={req.avatar} className="w-full h-full object-cover" /> : req.name.charAt(0).toUpperCase()}
                         </div>
                         <p className="font-bold uppercase tracking-wide">{req.name}</p>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => handleAcceptRequest(req.fromId)} className="bg-green-500 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider hover:bg-white hover:text-green-500 transition-colors">Accept</button>
                         <button onClick={() => handleRejectRequest(req.fromId)} className="bg-white/10 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider hover:bg-white hover:text-black transition-colors">Deny</button>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-white/10">
              <h2 className="text-xl font-black uppercase tracking-tighter mb-4 text-purple-500">Suggested Connections</h2>
              {suggestions.length === 0 ? (
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">NO NEW SUGGESTIONS AVAILABLE.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {suggestions.map(s => (
                    <div key={s.id} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center justify-between">
                       <div className="flex items-center gap-4 overflow-hidden">
                         <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold overflow-hidden shrink-0">
                           {s.avatar ? <img src={s.avatar} className="w-full h-full object-cover" /> : s.name.charAt(0).toUpperCase()}
                         </div>
                         <div className="overflow-hidden">
                           <p className="font-bold uppercase tracking-wide truncate">{s.name}</p>
                           <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">{s.bio || 'New Entity'}</p>
                         </div>
                       </div>
                       <button onClick={() => handleSendRequest(s.id)} className="bg-white/10 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider hover:bg-blue-500 transition-colors shrink-0">Connect</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-8 border-t border-white/10">
              <h2 className="text-xl font-black uppercase tracking-tighter mb-4">My Network</h2>
              {friends.length === 0 ? (
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">NO ESTABLISHED CONNECTIONS.</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {friends.map(f => (
                    <div key={f.id} className="bg-white/5 border border-white/10 p-4 rounded-3xl flex items-center gap-4 relative">
                       <div className="relative">
                         <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold overflow-hidden shrink-0">
                           {f.avatar ? <img src={f.avatar} className="w-full h-full object-cover" /> : f.name.charAt(0).toUpperCase()}
                         </div>
                         {f.isOnline && (
                           <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                         )}
                       </div>
                       <div className="overflow-hidden">
                         <p className="font-bold uppercase tracking-wide truncate">{f.name}</p>
                         <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">{f.isOnline ? 'Online' : 'Offline'}</p>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
