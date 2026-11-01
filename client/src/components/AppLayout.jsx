import { useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BriefcaseBusiness, ChevronDown, FileText, Gavel, LayoutDashboard, LogOut, MessageCircle, Search, Settings, ShieldCheck } from 'lucide-react'
import { useDemo } from '../context/useDemo'
import { formatDate } from '../data/mockData'
import { DemoNotice } from './UI'

const citizenLinks = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/assistant', label: 'Legal assistant', icon: MessageCircle },
  { to: '/app/lawyers', label: 'Find an advocate', icon: Search },
  { to: '/app/requests', label: 'Consultations & chats', icon: MessageCircle },
  { to: '/app/documents', label: 'My documents', icon: FileText },
]

const advocateLinks = [
  { to: '/advocate', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/advocate/requests', label: 'Requests & chats', icon: MessageCircle },
  { to: '/advocate/profile', label: 'My profile', icon: Settings },
]

const mobileLabels = {
  '/app': 'Home',
  '/app/assistant': 'Assistant',
  '/app/lawyers': 'Advocates',
  '/app/requests': 'Chats',
  '/app/documents': 'Files',
  '/advocate': 'Home',
  '/advocate/requests': 'Requests',
  '/advocate/profile': 'Profile',
}

export default function AppLayout({ role, children }) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const { user, signOut, requests, isSupabaseConfigured } = useDemo()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const links = role === 'advocate' ? advocateLinks : citizenLinks
  const home = role === 'advocate' ? '/advocate' : '/app'

  const logout = () => {
    setProfileMenuOpen(false)
    signOut().then(() => navigate('/')).catch(() => setLogoutError('Could not sign out. Check your connection and try again.'))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to={home}><span className="brand-mark"><Gavel size={19} /></span><span>Nyaya<span className="brand-light">Connect</span></span></Link>
        <div className="workspace-label">{role === 'advocate' ? 'ADVOCATE WORKSPACE' : 'CITIZEN WORKSPACE'}</div>
        <nav className="side-nav" aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><Icon size={18} /><span>{label}</span>{to === '/app/requests' && !isSupabaseConfigured && <span className="nav-count">{requests.length}</span>}</NavLink>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><ShieldCheck size={17} /><span>Your information stays in your control.</span></div>
          <button className="profile-menu" onClick={logout} aria-label="Sign out of demo account">
            <span className="avatar avatar-small">{user?.name?.slice(0, 1).toUpperCase() || 'Y'}</span>
            <span className="profile-meta"><strong>{user?.name || (role === 'advocate' ? 'Demo Advocate' : 'Demo Citizen')}</strong><small>{role === 'advocate' ? 'Advocate account' : 'Citizen account'}</small></span>
            <LogOut size={16} className="logout-icon" />
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <DemoNotice>{isSupabaseConfigured ? 'Supabase auth · Saved consultation requests and case communication' : 'Demo mode · Sample data only'}</DemoNotice>
          <div className="topbar-right"><div className="notification-wrap"><button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}><Bell size={18} /><span className="notification-dot" /></button>{notificationsOpen && <div className="notification-popover"><div className="notification-heading"><strong>Recent activity</strong><span>DEMO</span></div>{requests.slice(0, 3).map((request) => <Link key={request.id} to={role === 'advocate' ? '/advocate/requests' : '/app/requests'} onClick={() => setNotificationsOpen(false)}><span className="notification-item-icon"><BriefcaseBusiness size={15} /></span><span><strong>{request.advocateName}</strong><small>{request.status === 'counter_proposed' ? 'Proposed a different arrangement' : `Request ${request.status.replace('_', ' ')}`} · {formatDate(request.createdAt)}</small></span></Link>)}{!requests.length && <p>No demo activity yet.</p>}</div>}</div><span className="topbar-divider" /><span className="avatar avatar-small desktop-profile-avatar">{user?.name?.slice(0, 1).toUpperCase() || 'Y'}</span><span className="topbar-name">{user?.name || 'Demo user'}</span><ChevronDown size={15} className="muted" /><div className="mobile-profile-wrap"><button className="mobile-profile-button" type="button" aria-label="Open profile menu" aria-haspopup="menu" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}><span className="avatar avatar-small">{user?.name?.slice(0, 1).toUpperCase() || 'Y'}</span></button>{profileMenuOpen && <div className="mobile-profile-menu" role="menu"><span className="mobile-profile-name">{user?.name || 'Demo user'}</span><button type="button" role="menuitem" onClick={logout}><LogOut size={16} aria-hidden="true" /> Sign out</button></div>}</div></div>
        </header>
        <main className={`page-content ${pathname === '/app/assistant' ? 'page-content-assistant' : ''}`}>{logoutError && <p className="form-error" role="alert">{logoutError}</p>}{children}</main>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Workspace navigation">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `mobile-bottom-nav-link ${isActive ? 'mobile-bottom-nav-link-active' : ''}`}
            aria-label={label}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{mobileLabels[to] || label}</span>
            {to === '/app/requests' && requests.some((request) => request.status === 'pending') && (
              <span className="mobile-bottom-nav-dot" aria-label="Pending consultations" />
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
