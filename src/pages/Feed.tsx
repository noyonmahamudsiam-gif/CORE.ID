import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Send, Image as ImageIcon, Heart, MessageCircle, ShieldAlert, Trash2 } from 'lucide-react';
import PublicProfileModal from '../components/PublicProfileModal';

export default function Feed() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState<any | null>(null);

  const fetchPosts = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/posts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [token]);

  const handleBlock = async (authorId: string, authorName: string) => {
    if (!token || authorId === user?.id) return;
    if (confirm(`Are you sure you want to block ${authorName}? You won't see their posts or messages.`)) {
      try {
        await fetch(`/api/users/${authorId}/block`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchPosts(); // Refresh to remove blocked user's posts
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!token) return;
    if (confirm("Are you sure you want to delete this transmission?")) {
      try {
        await fetch(`/api/posts/${postId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchPosts(); // Refresh feed
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim() || !user) return;
    
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userId: user.id, text: newPostText })
      });
      setNewPostText('');
      fetchPosts(); // Refresh feed
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex justify-center w-full min-h-full">
      <div className="w-full max-w-4xl px-4 py-8">
        <header className="flex justify-between items-start mb-12">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400 font-bold">Platform Status 200</p>
            <h2 className="text-6xl md:text-8xl font-black leading-[0.8] tracking-tighter">DISCOVER<br/>YOUR<br/>SERVER.</h2>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-[0.2em] opacity-40 vertical-text h-32 text-right">GLOBAL FEED</span>
          </div>
        </header>
        
        {/* Create Post */}
        <div className="glass rounded-3xl p-6 md:p-8 mb-12">
          <form onSubmit={handlePostSubmit}>
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
                {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="w-full space-y-4">
                <textarea
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="TRANSMIT MESSAGE..."
                  className="w-full outline-none text-white text-xl font-bold bg-transparent resize-none min-h-[80px] placeholder:text-white/20 uppercase tracking-tighter"
                />
                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <div className="text-white/40 hover:text-white cursor-pointer transition-colors p-2 -ml-2">
                    <ImageIcon size={24} />
                  </div>
                  <button 
                    type="submit"
                    disabled={!newPostText.trim()}
                    className="bg-blue-500 text-white px-8 py-3 rounded-full font-black uppercase tracking-tighter hover:bg-white hover:text-black disabled:opacity-50 transition-colors shadow-lg shadow-blue-500/20"
                  >
                    TRANSMIT
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Feed Array */}
        <div className="space-y-6">
          {posts.map(post => (
            <div key={post.id} className="glass rounded-3xl p-6 md:p-8 flex flex-col justify-between group">
              <div className="mb-6">
                <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <button 
                      type="button" 
                      onClick={() => setSelectedProfileUser(post.author)}
                      className="w-10 h-10 rounded-full bg-gradient-to-bl from-purple-500 to-blue-500 flex items-center justify-center font-bold overflow-hidden shrink-0 hover:scale-105 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                    >
                       {post.author?.avatar ? <img src={post.author.avatar} className="w-full h-full object-cover" /> : (post.author?.name.charAt(0).toUpperCase() || '?')}
                    </button>
                    <div>
                      <button 
                        type="button" 
                        onClick={() => setSelectedProfileUser(post.author)}
                        className="font-black tracking-tight hover:text-blue-400 focus:text-blue-400 transition-colors text-left outline-none block"
                      >
                        {post.author?.name?.toUpperCase() || 'UNKNOWN'}
                      </button>
                      <p className="text-[10px] uppercase text-white/40 tracking-[0.1em]">
                        {formatDistanceToNow(post.timestamp)} AGO
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {post.author?.id !== user?.id ? (
                      <>
                        <button 
                          onClick={() => navigate('/chat', { state: { selectedUserId: post.author?.id } })}
                          title="Message User"
                          className="text-blue-500/50 hover:text-white hover:bg-blue-500 p-1.5 rounded-full transition-colors"
                        >
                          <MessageCircle size={16} />
                        </button>
                        <button 
                          onClick={() => handleBlock(post.author?.id, post.author?.name)}
                          title="Block User"
                          className="text-red-500/50 hover:text-white hover:bg-red-500 p-1.5 rounded-full transition-colors"
                        >
                          <ShieldAlert size={16} />
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => handleDeletePost(post.id)}
                        title="Delete Transmission"
                        className="text-red-500/50 hover:text-white hover:bg-red-500 p-1.5 rounded-full transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full font-bold uppercase tracking-wider group-hover:bg-blue-500 transition-colors">Record</span>
                  </div>
                </div>
                
                <p className="text-white text-xl md:text-2xl font-bold leading-tight tracking-tight whitespace-pre-wrap">{post.text}</p>
              </div>
              
              <div className="flex items-center gap-6 pt-4 text-white/40">
                <button className="flex items-center gap-2 hover:text-white transition-colors">
                  <Heart size={20} /> <span className="text-sm font-bold uppercase">{post.likes}</span>
                </button>
                <button className="flex items-center gap-2 hover:text-white transition-colors">
                  <MessageCircle size={20} /> <span className="text-sm font-bold uppercase">{post.comments?.length || 0}</span>
                </button>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="text-center py-20 text-white/40 font-bold uppercase tracking-widest text-sm">
              NO TRANSMISSIONS DETECTED.
            </div>
          )}
        </div>
      </div>
      
      {selectedProfileUser && (
        <PublicProfileModal 
          user={selectedProfileUser} 
          onClose={() => setSelectedProfileUser(null)} 
        />
      )}
    </div>
  );
}
