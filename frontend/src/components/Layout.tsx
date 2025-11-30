import { NavLink } from 'react-router-dom';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

function Layout({ children }: Props) {
  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `nav-link${isActive ? ' active' : ''}`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Docker Web Manager</h1>
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
        </div>
        <span className="inline-hint">Stage 6 — System cleanup & stats</span>
      </aside>
      <main className="content-area">{children}</main>
    </div>
  );
}

export default Layout;
