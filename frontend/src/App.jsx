import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';

// Public Pages
import HomePage from './pages/public/HomePage';
import EventDetailsPage from './pages/public/EventDetailsPage';
import RegistrationPage from './pages/public/RegistrationPage';
import SuccessPage from './pages/public/SuccessPage';

// Scanner Page
import ScannerPage from './pages/scanner/ScannerPage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import EventListPage from './pages/admin/EventListPage';
import CreateEventPage from './pages/admin/CreateEventPage';
import EditEventPage from './pages/admin/EditEventPage';
import FormBuilderPage from './pages/admin/FormBuilderPage';
import RegistrationsPage from './pages/admin/RegistrationsPage';

// Layout
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/events/:id" element={<EventDetailsPage />} />
            <Route path="/events/:id/register" element={<RegistrationPage />} />
            <Route path="/success" element={<SuccessPage />} />
          </Route>

          {/* Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Scanner Route */}
          <Route path="/scanner" element={<ScannerPage />} />

          {/* Admin Routes */}
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/events" element={<EventListPage />} />
            <Route path="/admin/events/create" element={<CreateEventPage />} />
            <Route path="/admin/events/:id/edit" element={<EditEventPage />} />
            <Route path="/admin/events/:id/form" element={<FormBuilderPage />} />
            <Route path="/admin/events/:id/registrations" element={<RegistrationsPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
