import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';

function Layout() {
  const { user, logout } = useAuth();
  const { config } = useConfig();
  const navigate = useNavigate();
  const navLinkClasses = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active' : ''}`;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <h1>Docker Web Manager</h1>
            <span className="inline-hint">Stage 7 — Polishing &amp; Security</span>
          </div>
          <div className="user-chip">
            <div>
              <div className="user-name">{user}</div>
              <span className="inline-hint">Theme: {config?.theme ?? 'light'}</span>
            </div>
            <button className="button" onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
        </div>
        <div className="nav-section">
          <NavLink to="/compose" className={navLinkClasses}>
            Compose
          </NavLink>
          <NavLink to="/containers" className={navLinkClasses}>
            Containers
          </NavLink>
          <NavLink to="/volumes" className={navLinkClasses}>
            Volumes
          </NavLink>
          <NavLink to="/networks" className={navLinkClasses}>
            Networks
          </NavLink>
          <NavLink to="/images" className={navLinkClasses}>
            Images
          </NavLink>
          <NavLink to="/cleanup" className={navLinkClasses}>
            Cleanup
          </NavLink>
          <NavLink to="/config" className={navLinkClasses}>
            Config
          </NavLink>
        </div>
      </aside>
      <main className="content-area">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
