import { Navigate, Route, Routes } from 'react-router-dom';
import ContainersPage from './pages/ContainersPage';
import VolumesPage from './pages/VolumesPage';
import NetworksPage from './pages/NetworksPage';
import ImagesPage from './pages/ImagesPage';
import Layout from './components/Layout';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/containers" element={<ContainersPage />} />
        <Route path="/volumes" element={<VolumesPage />} />
        <Route path="/networks" element={<NetworksPage />} />
        <Route path="/images" element={<ImagesPage />} />
        <Route path="*" element={<Navigate to="/containers" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
