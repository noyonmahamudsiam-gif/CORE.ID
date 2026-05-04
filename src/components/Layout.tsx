import React from 'react';
import { Routes, Route, Navigate, Outlet, Link, NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="flex h-screen bg-black text-white p-4 md:p-8 gap-4 md:gap-8 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="flex flex-col justify-between w-20 md:w-1/4 xl:w-1/5 border-r border-white/10 pr-4 md:pr-8 h-full">
        <div className="space-y-12 shrink-0">
          <Link to="/" className="block">
            <h1 className="text-xl md:text-4xl font-black tracking-tighter truncate">
              CORE.<span className="text-blue-500">ID</span>
            </h1>
          </Link>
          
          <nav className="space-y-4">
            <NavItem to="/" label="DISCOVER" />
            <NavItem to="/chat" label="MESSAGES" />
            <NavItem to="/profile" label="PROFILE" />
            <button 
              onClick={logout}
              className="block text-xs md:text-xl font-bold opacity-40 hover:opacity-100 transition-opacity text-left uppercase w-full mt-8"
            >
               LOGOUT
            </button>
          </nav>
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-end gap-2 md:gap-4 mb-4 md:mb-0">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center font-bold shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="hidden md:block overflow-hidden">
            <p className="font-bold leading-none truncate">{user.name}</p>
            <p className="text-[10px] opacity-50 uppercase tracking-[0.2em] mt-1 whitespace-nowrap">Online Now</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative no-scrollbar overflow-y-auto">
        <Outlet />
      </main>

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
        block text-xs md:text-xl font-bold transition-opacity
        ${isActive ? 'border-b-2 border-blue-500 pb-1 w-fit opacity-100' : 'opacity-40 hover:opacity-100'}
      `}
    >
      <span className="hidden md:block">{label}</span>
      <span className="block md:hidden">{label.substring(0, 3)}</span>
    </NavLink>
  );
}
