import { Navigate, Route, Routes } from 'react-router-dom';
import ContainersPage from './pages/ContainersPage';
import VolumesPage from './pages/VolumesPage';
import NetworksPage from './pages/NetworksPage';
import ImagesPage from './pages/ImagesPage';
import Layout from './components/Layout';
import ComposePage from './pages/ComposePage';
import CleanupPage from './pages/CleanupPage';
import RequireAuth from './components/RequireAuth';
import AuthPage from './pages/AuthPage';
import ConfigPage from './pages/ConfigPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="/containers" element={<ContainersPage />} />
          <Route path="/compose" element={<ComposePage />} />
          <Route path="/volumes" element={<VolumesPage />} />
          <Route path="/networks" element={<NetworksPage />} />
          <Route path="/images" element={<ImagesPage />} />
          <Route path="/cleanup" element={<CleanupPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="*" element={<Navigate to="/containers" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
