import React, { useState, useEffect } from 'react';
import { X, UserPlus, MessageCircle, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function PublicProfileModal({ user, onClose }: { user: any, onClose: () => void }) {
  const { token, user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'friends'>('none');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    const fetchStatus = async () => {
      try {
        // Check friends
        const friendsRes = await fetch('/api/friends', { headers: { Authorization: `Bearer ${token}` } });
        const friends = await friendsRes.json();
        if (friends.some((f: any) => f.id === user.id)) {
          setRequestStatus('friends');
          return;
        }

        // Check incoming requests
        const incRes = await fetch('/api/friends/requests', { headers: { Authorization: `Bearer ${token}` } });
        const incReqs = await incRes.json();
        if (incReqs.some((r: any) => r.fromId === user.id)) {
          setRequestStatus('none'); // Allow accepting? Usually it's reciprocal or we can just say 'none' and let them use the generic add
        }

        // Check outgoing requests
        const outRes = await fetch('/api/friends/requests/sent', { headers: { Authorization: `Bearer ${token}` } });
        const outReqs = await outRes.json();
        if (outReqs.some((r: any) => r.toId === user.id)) {
          setRequestStatus('pending');
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStatus();
  }, [user, token]);

  const handleAddFriend = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ toId: user.id })
      });
      const data = await res.json();
      if (data.error === "Request already exists or are already friends") {
         setRequestStatus('pending'); // Close enough
      } else if (data.success) {
         setRequestStatus('pending');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    navigate('/chat', { state: { selectedUserId: user.id } });
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg glass rounded-3xl p-6 md:p-8 animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center mb-8">
           <div className="w-24 h-24 rounded-full bg-gradient-to-bl from-purple-500 to-blue-500 flex items-center justify-center font-bold text-3xl overflow-hidden mb-4 shadow-xl shadow-purple-500/20 text-white relative group">
              {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
           </div>
           <h2 className="text-3xl font-black tracking-tighter uppercase whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-white">{user.name}</h2>
           {user.username && <p className="text-sm font-bold uppercase tracking-widest text-blue-400 mt-1">{user.username}</p>}
           
           <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
             {user.gender && (
               <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded">
                 {user.gender}
                 {user.genderVerified && <span className="text-green-400 ml-1">✓ AI VFD</span>}
               </span>
             )}
             {user.dateOfBirth && (
               <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded">
                 {user.dateOfBirth}
                 {user.ageVerified && <span className="text-green-400 ml-1">✓ ID VFD</span>}
               </span>
             )}
             <span className="text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 px-2 py-1 rounded">
                 EMAIL
                 <span className="text-green-400 ml-1">✓ VFD</span>
             </span>
           </div>
        </div>

        <div className="space-y-6">
          {(user.showAboutMe && user.aboutMe) && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-2">About Me</h3>
              <p className="text-sm font-bold text-white/80 whitespace-pre-wrap">{user.aboutMe}</p>
            </div>
          )}

          {user.bio && (
            <div className="bg-black/20 border border-white/5 rounded-2xl p-4">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-2">Bio / Public Logs</h3>
              <p className="text-sm font-bold text-white/80 whitespace-pre-wrap">{user.bio}</p>
            </div>
          )}

          {user.interests && user.interests.length > 0 && (
            <div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold mb-2">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest: string, i: number) => (
                  <span key={i} className="text-xs font-bold uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-full border border-white/20 text-white truncate">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-white/10">
             {currentUser?.id !== user.id && (
                <>
                  <button 
                    onClick={requestStatus !== 'pending' && requestStatus !== 'friends' ? handleAddFriend : undefined}
                    disabled={requestStatus === 'pending' || requestStatus === 'friends' || loading}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black uppercase tracking-wider text-sm transition-all focus:outline-none ${
                      requestStatus === 'pending' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50 cursor-not-allowed' :
                      requestStatus === 'friends' ? 'bg-green-500/20 text-green-400 border border-green-500/50 cursor-not-allowed' :
                      'bg-white text-black hover:bg-blue-500 hover:text-white shadow-lg shadow-white/10'
                    }`}
                  >
                    {requestStatus === 'pending' ? (
                      <><Check size={18} /> Request Sent</>
                    ) : requestStatus === 'friends' ? (
                      <><Check size={18} /> Friends</>
                    ) : (
                      <><UserPlus size={18} /> Add Friend</>
                    )}
                  </button>
                  <button 
                    onClick={handleSendMessage}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black uppercase tracking-wider text-sm bg-blue-500 text-white hover:bg-white hover:text-black transition-all shadow-lg shadow-blue-500/20 focus:outline-none"
                  >
                    <MessageCircle size={18} /> Send Message
                  </button>
                </>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
