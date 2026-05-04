import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { Send, MessageCircle, ShieldAlert } from 'lucide-react';

export default function Chat() {
  const { user, token } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchUsers = () => {
    if (!token) return;
    fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setUsers(data.filter((u: any) => u.id !== user?.id));
      });
  };

  // Fetch all users to chat with
  useEffect(() => {
    fetchUsers();
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
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Fetch chat history when selecting a user
  useEffect(() => {
    if (selectedUser && socket && user) {
      // Clear current messages
      setMessages([]);
      socket.emit('getMessages', { userId: user.id, otherId: selectedUser.id }, (history: any[]) => {
        setMessages(history);
      });
    }
  }, [selectedUser, socket, user]);

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

  return (
    <div className="flex justify-center w-full min-h-full">
      <div className="w-full max-w-6xl px-4 py-8 flex gap-8 h-full">
        {/* Sidebar - Users */}
        <div className="w-1/3 max-w-sm flex flex-col h-full border-r border-white/10 pr-4 md:pr-8 shrink-0">
          <header className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-purple-400 font-bold mb-1">Comms Links</p>
            <h2 className="text-4xl md:text-5xl font-black leading-none tracking-tighter">MESSAGES</h2>
          </header>
          <div className="overflow-y-auto flex-1 no-scrollbar space-y-4 pr-2">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`w-full glass rounded-3xl p-4 flex items-center gap-4 transition-all text-left
                  ${selectedUser?.id === u.id ? 'border-purple-500 bg-white/10' : 'hover:bg-white/10'}
                `}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-bl from-purple-500 to-blue-500 flex items-center justify-center font-bold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-black text-lg tracking-tight truncate">{u.name?.toUpperCase()}</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest truncate">Secure Channel</p>
                </div>
              </button>
            ))}
            {users.length === 0 && (
               <div className="p-6 text-center text-white/40 text-sm font-bold uppercase tracking-widest">
                 NO SIGNALS DETECTED.
               </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        {selectedUser ? (
          <div className="flex-1 flex flex-col h-full relative border border-white/10 rounded-3xl overflow-hidden glass">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/40 z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-bl from-purple-500 to-blue-500 flex items-center justify-center font-bold">
                   {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-black text-2xl tracking-tighter">{selectedUser.name?.toUpperCase()}</h3>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Encrypted Stream</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleBlock}
                  title="Block User"
                  className="text-red-500 hover:text-white hover:bg-red-500 p-2 rounded-full transition-colors opacity-50 hover:opacity-100"
                >
                  <ShieldAlert size={20} />
                </button>
                <span className="text-[10px] bg-purple-500 text-white px-3 py-1 rounded-full font-bold uppercase tracking-wider">Live</span>
              </div>
            </div>

            {/* Messages Wrapper */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {currentMessages.map(msg => {
                const isMine = msg.fromId === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] md:max-w-[60%] rounded-3xl p-5 ${isMine ? 'bg-blue-600 text-white rounded-br-sm' : 'glass text-white rounded-bl-sm'}`}>
                      <p className="font-bold text-lg leading-tight">{msg.text}</p>
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
            <div className="p-6 border-t border-white/10 shrink-0 bg-black/40">
              <form onSubmit={sendMessage} className="flex gap-4">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="TRANSMIT MESSAGE..."
                  className="flex-1 px-6 py-4 rounded-full glass focus:border-blue-500 bg-transparent outline-none transition-colors font-bold uppercase tracking-tighter placeholder:text-white/20"
                />
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="bg-purple-600 text-white p-4 rounded-full hover:bg-white hover:text-black disabled:opacity-50 transition-colors shadow-lg shadow-purple-600/20"
                >
                  <Send size={24} />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-white/40 p-8 glass rounded-3xl border border-white/10 m-8">
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
