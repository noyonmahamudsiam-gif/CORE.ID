import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { Send, MessageCircle, ShieldAlert, Search } from 'lucide-react';

export default function Chat() {
  const location = useLocation();
  const { user, token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnline, setFilterOnline] = useState(false);
  const [filterSharedInterests, setFilterSharedInterests] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<any | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchUsers = () => {
    if (!token) return;
    fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        const filtered = data.filter((u: any) => u.id !== user?.id);
        setUsers(filtered);
        
        // Auto-select user from navigation state if present
        if (location.state?.selectedUserId) {
          const u = filtered.find((usr: any) => usr.id === location.state.selectedUserId);
          if (u) setSelectedUser(u);
          // clear state so it doesn't re-select randomly on refresh
          window.history.replaceState({}, document.title)
        }
      });
  };

  const fetchUnreadCounts = () => {
    if (!token) return;
    fetch('/api/messages/unread-counts', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setUnreadCounts(data);
      });
  };

  // Fetch all users to chat with
  useEffect(() => {
    fetchUsers();
    fetchUnreadCounts();
  }, [user, token]);

  const handleBlock = async () => {
    if (!selectedUser || !token) return;
    if (confirm(`Are you sure you want to block ${selectedUser.name}? You won't see their posts or messages.`)) {
      try {
        await fetch(`/api/users/${selectedUser.id}/block`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        setSelectedUser(null);
        fetchUsers(); // Refresh to remove blocked user
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Setup Socket.IO
  useEffect(() => {
    if (!user) return;
    const newSocket = io({ autoConnect: true });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('register', user.id);
    });

    newSocket.on('receiveMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
      if (msg.fromId !== user.id && msg.fromId !== selectedUser?.id) {
        setUnreadCounts(prev => ({ ...prev, [msg.fromId]: (prev[msg.fromId] || 0) + 1 }));
      }
    });

    newSocket.on('userStatusChange', ({ userId, isOnline }) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isOnline } : u));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user, selectedUser]); // Re-bind when selectedUser changes to correctly handle unreadCounts

  // Fetch chat history when selecting a user
  useEffect(() => {
    if (selectedUser && socket && user) {
      // Clear current messages
      setMessages([]);
      socket.emit('getMessages', { userId: user.id, otherId: selectedUser.id }, (history: any[]) => {
        setMessages(history);
      });

      // Mark as read
      if (unreadCounts[selectedUser.id]) {
        fetch('/api/messages/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fromId: selectedUser.id })
        });
        setUnreadCounts(prev => ({ ...prev, [selectedUser.id]: 0 }));
      }
    }
  }, [selectedUser, socket, user, token, unreadCounts]);

  // Auto-scroll Down
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser || !socket || !user) return;

    const msgData = {
      fromId: user.id,
      toId: selectedUser.id,
      text: inputText
    };

    socket.emit('sendMessage', msgData);
    setInputText('');
  };

  // Filter messages belonging to the conversation with selectedUser
  const currentMessages = messages.filter(
    m => (m.fromId === user?.id && m.toId === selectedUser?.id) || 
         (m.fromId === selectedUser?.id && m.toId === user?.id)
  );

  const filteredUsers = users.filter((u: any) => {
    if (!u.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    if (filterOnline && !u.isOnline) return false;
    
    if (filterSharedInterests) {
      if (!user?.interests || user.interests.length === 0) return false;
      if (!u.interests || u.interests.length === 0) return false;
      const userInterests = user.interests.map((i: string) => i.toLowerCase());
      const hasShared = u.interests.some((i: string) => userInterests.includes(i.toLowerCase()));
      if (!hasShared) return false;
    }
    
    return true;
  });

  return (
    <div className="flex justify-center w-full min-h-full h-full">
      <div className="w-full max-w-6xl md:px-4 py-2 md:py-8 flex flex-col md:flex-row gap-4 md:gap-8 h-full relative">
        {/* Sidebar - Users */}
        <div className={`w-full md:w-1/3 md:max-w-sm flex flex-col h-full md:border-r border-white/10 md:pr-8 shrink-0 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
          <header className="mb-4 px-4 md:px-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-purple-400 font-bold mb-1">Comms Links</p>
            <h2 className="text-3xl md:text-5xl font-black leading-none tracking-tighter">MESSAGES</h2>
          </header>

          <div className="px-4 md:px-0 mb-4 shrink-0 space-y-3">
             <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40">
                 <Search size={16} />
               </div>
               <input 
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="SEARCH ENTITIES..."
                 className="w-full pl-12 pr-4 py-3 rounded-2xl glass bg-white/5 border border-white/10 focus:border-purple-500 outline-none text-sm font-bold uppercase tracking-widest placeholder:text-white/20 transition-colors text-white"
               />
             </div>
             <div className="flex gap-2">
               <button 
                 onClick={() => setFilterOnline(!filterOnline)}
                 className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border ${filterOnline ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
               >
                 Online
               </button>
               <button 
                 onClick={() => setFilterSharedInterests(!filterSharedInterests)}
                 className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors border ${filterSharedInterests ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
               >
                 Shared Interests
               </button>
             </div>
          </div>

          <div className="overflow-y-auto flex-1 no-scrollbar space-y-4 pr-2 px-4 md:px-0">
            {filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`w-full glass rounded-3xl p-4 flex items-center gap-4 transition-all text-left relative
                  ${selectedUser?.id === u.id ? 'border-purple-500 bg-white/10' : 'hover:bg-white/10'}
                `}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-bl from-purple-500 to-blue-500 flex items-center justify-center font-bold shrink-0 overflow-hidden">
                    {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                  </div>
                  {u.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-black rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  )}
                </div>
                <div className="overflow-hidden flex-1">
                  <h3 className="font-black text-lg tracking-tight truncate">{u.name?.toUpperCase()}</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">
                    {u.aboutMe || (u.isOnline ? 'Online' : 'Secure Channel')}
                  </p>
                </div>
                {unreadCounts[u.id] > 0 && (
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center font-bold text-xs shadow-lg shadow-red-500/20 shrink-0">
                    {unreadCounts[u.id]}
                  </div>
                )}
              </button>
            ))}
            {filteredUsers.length === 0 && (
               <div className="p-6 text-center text-white/40 text-sm font-bold uppercase tracking-widest">
                 NO SIGNALS DETECTED.
               </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        {selectedUser ? (
          <div className="flex-1 flex flex-col h-full relative md:border border-white/10 md:rounded-3xl overflow-hidden glass absolute inset-0 md:relative z-20">
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-black/40 z-10 shrink-0">
              <div className="flex items-center gap-4">
                <button 
                  className="md:hidden text-white/60 hover:text-white"
                  onClick={() => setSelectedUser(null)}
                >
                  ← BACK
                </button>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-bl from-purple-500 to-blue-500 flex items-center justify-center font-bold overflow-hidden shrink-0">
                   {selectedUser.avatar ? <img src={selectedUser.avatar} className="w-full h-full object-cover" /> : selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-xl md:text-2xl tracking-tighter truncate max-w-[120px] md:max-w-none">{selectedUser.name?.toUpperCase()}</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 hidden md:block truncate max-w-[200px]">
                    {selectedUser.aboutMe || 'Encrypted Stream'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-4 shrink-0">
                <button 
                  onClick={handleBlock}
                  title="Block User"
                  className="text-red-500 hover:text-white hover:bg-red-500 p-2 rounded-full transition-colors opacity-50 hover:opacity-100"
                >
                  <ShieldAlert size={18} />
                </button>
                <span className="text-[10px] bg-purple-500 text-white px-2 md:px-3 py-1 rounded-full font-bold uppercase tracking-wider">Live</span>
              </div>
            </div>

            {/* Messages Wrapper */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-6 no-scrollbar">
              {currentMessages.map(msg => {
                const isMine = msg.fromId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] md:max-w-[60%] rounded-3xl p-4 md:p-5 ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'glass text-white rounded-bl-sm'}`}>
                      <p className="font-bold text-base md:text-lg leading-tight">{msg.text}</p>
                      <p className={`text-[10px] uppercase tracking-widest mt-2 ${isMine ? 'text-blue-200' : 'text-white/40'}`}>
                        {format(msg.timestamp, 'HH:mm')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 md:p-6 border-t border-white/10 shrink-0 bg-black/40">
              <form onSubmit={sendMessage} className="flex gap-2 md:gap-4 items-center">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="TRANSMIT MESSAGE..."
                  className="flex-1 px-4 md:px-6 py-3 md:py-4 text-sm md:text-base rounded-full glass focus:border-blue-500 bg-transparent outline-none transition-colors font-bold uppercase tracking-tighter placeholder:text-white/20"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="bg-purple-600 text-white p-3 md:p-4 rounded-full hover:bg-white hover:text-black disabled:opacity-50 transition-colors shadow-lg shadow-purple-600/20 shrink-0"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-white/40 p-8 glass rounded-3xl border border-white/10 m-8">
            <MessageCircle size={80} className="mb-6 opacity-20" />
            <h2 className="text-3xl font-black uppercase tracking-tighter text-white/60">AWAITING CONNECTION</h2>
            <p className="text-center mt-4 max-w-sm text-sm font-bold tracking-widest uppercase">
              Select a secure channel from the list to establish comms.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
