import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Bell } from 'lucide-react';

export default function Layout() {
  const { user, token, logout } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (token) {
      fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setNotifications(data));
    }
  }, [token, location.pathname]); // Refresh on navigation

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  const handleRead = () => {
    if (!token) return;
    fetch('/api/notifications/read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    });
  };

  const toggleNotifs = () => {
    setShowNotifs(!showNotifs);
    if (!showNotifs && unreadNotifsCount > 0) {
      handleRead();
    }
  };

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="flex h-[100dvh] bg-black text-white md:p-8 md:gap-8 overflow-hidden flex-col md:flex-row relative">
      {/* Mobile Header */}
      <header className="md:hidden flex justify-between items-center p-4 border-b border-white/10 shrink-0 bg-black/50 backdrop-blur-md z-40 relative">
        <Link to="/" className="block">
          <h1 className="text-2xl font-black tracking-tighter truncate">
            CORE.<span className="text-blue-500">ID</span>
          </h1>
        </Link>
        <div className="flex items-center gap-4">
          <button onClick={toggleNotifs} className="relative">
            <Bell size={20} className="opacity-80" />
            {unreadNotifsCount > 0 && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-black"></span>}
          </button>
          <Link to="/profile">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold overflow-hidden shrink-0">
              {user.avatar ? <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
            </div>
          </Link>
        </div>
        {/* Mobile Notifs Dropdown */}
        {showNotifs && (
          <div className="absolute top-16 right-4 w-72 glass rounded-2xl p-4 z-50 border border-white/10 max-h-[60vh] overflow-y-auto">
            <h3 className="font-black tracking-widest uppercase mb-4 text-xs">Notifications</h3>
            {notifications.length === 0 ? <p className="text-xs text-white/40">NO ALERTS.</p> : (
              <div className="space-y-3">
                {notifications.map(n => (
                  <div key={n.id} className="text-xs border-b border-white/10 pb-2 last:border-0 last:pb-0">
                    <p className={`${n.read ? 'text-white/60' : 'text-white font-bold'}`}>{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col justify-between w-1/4 xl:w-1/5 border-r border-white/10 pr-8 h-full shrink-0 relative">
        <div className="space-y-12 shrink-0">
          <Link to="/" className="block">
            <h1 className="text-4xl font-black tracking-tighter truncate">
              CORE.<span className="text-blue-500">ID</span>
            </h1>
          </Link>
          
          <nav className="space-y-4">
            <NavItem to="/" label="DISCOVER" />
            <NavItem to="/chat" label="MESSAGES" />
            <NavItem to="/profile" label="PROFILE" />
            <div className="relative pt-4">
              <button 
                onClick={toggleNotifs}
                className={`flex gap-4 items-center text-xl font-bold transition-opacity text-left uppercase w-full ${showNotifs ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
              >
                <span>ALERTS</span>
                {unreadNotifsCount > 0 && <span className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center font-bold text-xs shrink-0">{unreadNotifsCount}</span>}
              </button>
              
              {showNotifs && (
                <div className="absolute top-12 left-0 w-80 glass rounded-2xl p-6 z-50 border border-white/10 max-h-[50vh] overflow-y-auto no-scrollbar shadow-2xl">
                  <h3 className="font-black tracking-widest uppercase mb-4 text-sm text-blue-500">System Alerts</h3>
                  {notifications.length === 0 ? <p className="text-xs text-white/40 font-bold uppercase tracking-widest">NO ALERTS.</p> : (
                    <div className="space-y-4">
                      {notifications.map(n => (
                        <div key={n.id} className="text-sm border-b border-white/10 pb-3 last:border-0 last:pb-0">
                          <p className={`${n.read ? 'text-white/60' : 'text-white font-bold'}`}>{n.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={logout}
              className="block text-xl font-bold opacity-40 hover:opacity-100 transition-opacity text-left uppercase w-full mt-8"
            >
               LOGOUT
            </button>
          </nav>
        </div>

        <div className="flex flex-row items-end gap-4 mb-0">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center font-bold shrink-0 overflow-hidden">
            {user.avatar ? <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" /> : user.name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="font-bold leading-none truncate">{user.name}</p>
            <p className="text-[10px] opacity-50 uppercase tracking-[0.2em] mt-1 whitespace-nowrap">Online Now</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative no-scrollbar overflow-y-auto pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass grid grid-cols-3 z-50 h-16 safe-area-bottom">
        <MobileNav to="/" label="FIND" />
        <MobileNav to="/chat" label="COMMS" />
        <MobileNav to="/profile" label="ID" />
      </nav>

      {/* Decorative Sidebar */}
      <div className="hidden lg:flex w-[60px] flex-col items-center justify-center border-l border-white/10 gap-8 h-full shrink-0">
        <div className="vertical-text text-[10px] font-bold tracking-[0.5em] text-white/30 uppercase">Friend-Making Foundation</div>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0"></div>
        <div className="vertical-text text-[10px] font-bold tracking-[0.5em] text-white/30 uppercase">Safety Secured</div>
      </div>
    </div>
  );
}

function NavItem({ to, label }: { to: string, label: string }) {
  return (
    <NavLink 
      to={to}
      className={({ isActive }: any) => `
        block text-xl font-bold transition-opacity
        ${isActive ? 'border-b-2 border-blue-500 pb-1 w-fit opacity-100' : 'opacity-40 hover:opacity-100'}
      `}
    >
      <span>{label}</span>
    </NavLink>
  );
}

function MobileNav({ to, label }: { to: string, label: string }) {
  return (
    <NavLink 
      to={to}
      className={({ isActive }: any) => `
        flex flex-col items-center justify-center font-bold tracking-widest text-[10px] transition-all hover:bg-white/5
        ${isActive ? 'text-blue-500 bg-white/5 border-t-2 border-blue-500' : 'text-white/40 border-t-2 border-transparent'}
      `}
    >
      {label}
    </NavLink>
  );
}
