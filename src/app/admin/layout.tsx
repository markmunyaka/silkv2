'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminRoute } from '@/components/AdminRoute';
import type { AdminNotification } from '@/types/admin';

const sidebarItems = [
  { name: 'Dashboard', href: '/admin', icon: '📊' },
  { name: 'Users', href: '/admin/users', icon: '👥' },
  { name: 'SMTP Providers', href: '/admin/smtp-providers', icon: '📧' },
  { name: 'Email Bomber', href: '/admin/email-bomber', icon: '💣' },
  { name: 'RDP Products', href: '/admin/rdp-products', icon: '🖥️' },
  { name: 'cPanel Products', href: '/admin/cpanel-products', icon: '🌐' },
  { name: 'Analytics', href: '/admin/analytics', icon: '📈' },
  { name: 'Settings', href: '/admin/settings', icon: '⚙️' },
];

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard Overview',
  '/admin/users': 'User Management',
  '/admin/smtp-providers': 'SMTP Providers',
  '/admin/email-bomber': 'Email Bomber',
  '/admin/rdp-products': 'RDP Products',
  '/admin/cpanel-products': 'cPanel Products',
  '/admin/analytics': 'Analytics',
  '/admin/settings': 'Settings',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const currentTitle = pageTitles[pathname] || 'Admin';
  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  // Fetch real notifications from the database
  const fetchNotifications = useCallback(() => {
    fetch('/api/admin/notifications')
      .then((res) => res.json())
      .then((json) => {
        if (json.ok && json.data) {
          setNotifications(json.data);
        }
      })
      .catch(() => {
        // Silently fail — notifications will just be empty
      });
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setShowNotifications(false);
  }, []);

  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    ...(pathname !== '/admin' ? [{ label: currentTitle, href: pathname }] : []),
  ];

  return (
    <AdminRoute>
      <div className="min-h-screen bg-[#0a0a0a] flex">
        {/* Sidebar */}
        <aside className={`fixed left-0 top-0 z-40 h-screen transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
          <div className="h-full glass-lg rounded-none border-r border-white/5 flex flex-col">
            {/* Logo */}
            <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-lg font-bold text-black shrink-0 shadow-lg shadow-accent-gold/20">
                S
              </div>
              <span className={`font-serif text-xl text-accent-gold whitespace-nowrap transition-all duration-300 ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                Silk Admin
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
              {sidebarItems.map((item) => {
                const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                      isActive
                        ? 'bg-gradient-to-r from-accent-gold/20 to-accent-neon-blue/10 border border-accent-gold/30 shadow-lg shadow-accent-gold/5'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <span className="text-xl shrink-0">{item.icon}</span>
                    <span className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ${sidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'} ${isActive ? 'text-accent-gold' : 'text-foreground-secondary group-hover:text-white'}`}>
                      {item.name}
                    </span>
                    {isActive && !sidebarCollapsed && <span className="ml-auto w-2 h-2 rounded-full bg-accent-gold animate-pulse" />}
                  </Link>
                );
              })}
            </nav>

            {/* Collapse toggle */}
            <div className="p-3 border-t border-white/5">
              <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-foreground-secondary hover:text-white hover:bg-white/5 transition-all">
                <span className="text-lg transition-transform duration-300" style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>◀</span>
                {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
          {/* Top Navbar */}
          <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/60 border-b border-white/5">
            <div className="flex items-center justify-between px-8 py-3">
              {/* Breadcrumbs */}
              <div>
                <div className="flex items-center gap-2 text-xs text-foreground-secondary/60 mb-0.5">
                  {breadcrumbs.map((b, i) => (
                    <span key={b.href} className="flex items-center gap-2">
                      {i > 0 && <span>/</span>}
                      <Link href={b.href} className="hover:text-accent-gold transition-colors">{b.label}</Link>
                    </span>
                  ))}
                  <span className="text-foreground-secondary/40 ml-2">•</span>
                  <span className="text-foreground-secondary/40">{currentTime}</span>
                </div>
                <h2 className="text-lg font-serif text-white">{currentTitle}</h2>
              </div>

              <div className="flex items-center gap-4">
                {/* Notifications */}
                <div className="relative">
                  <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                    <span className="text-lg">🔔</span>
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-accent-gold text-black animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown */}
                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 glass-lg rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-fade-in z-50">
                      <div className="p-3 border-b border-white/5 flex items-center justify-between">
                        <span className="text-sm font-medium text-white">Notifications</span>
                        <button onClick={markAllRead} className="text-xs text-accent-gold hover:underline">Mark all read</button>
                      </div>
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-foreground-secondary text-sm">No notifications</div>
                      ) : (
                        <div className="max-h-[320px] overflow-y-auto">
                          {notifications.map((n) => (
                            <div key={n.id} className={`p-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors ${!n.read ? 'bg-white/[0.02]' : ''}`}>
                              <div className="flex items-start gap-3">
                                <span className={`mt-0.5 text-sm ${n.type === 'error' ? 'text-red-400' : n.type === 'warning' ? 'text-amber-400' : n.type === 'success' ? 'text-emerald-400' : 'text-accent-neon-blue'}`}>
                                  {n.type === 'error' ? '🔴' : n.type === 'warning' ? '🟡' : n.type === 'success' ? '🟢' : '🔵'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-medium">{n.title}</p>
                                  <p className="text-xs text-foreground-secondary mt-0.5 truncate">{n.message}</p>
                                  <p className="text-[10px] text-foreground-secondary/50 mt-1">{new Date(n.timestamp).toLocaleTimeString()}</p>
                                </div>
                                {!n.read && <span className="w-2 h-2 rounded-full bg-accent-gold shrink-0 mt-1.5" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Admin avatar */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-sm font-bold text-black shadow-lg shadow-accent-gold/20 cursor-pointer">
                  A
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="p-8">{children}</main>
        </div>
      </div>
    </AdminRoute>
  );
}