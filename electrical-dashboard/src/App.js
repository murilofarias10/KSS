import { Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './UploadPage';
import GalleryPage from './GalleryPage';
import Dashboard from './Dashboard';

function App() {
  return (
    <Routes>
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/gallery" element={<GalleryPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/upload" />} />
    </Routes>
  );
}

export default App;
