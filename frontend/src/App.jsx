import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useTheme } from './contexts/ThemeContext';

// Public Pages
import HomePage from './pages/public/HomePage';
import EventDetailsPage from './pages/public/EventDetailsPage';
import RegistrationPage from './pages/public/RegistrationPage';
import SuccessPage from './pages/public/SuccessPage';
import PhonePeCallbackPage from './pages/public/PhonePeCallbackPage';

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
import AnalyticsPage from './pages/admin/AnalyticsPage';
import FinancialsPage from './pages/admin/FinancialsPage';
import DiscountCodesPage from './pages/admin/DiscountCodesPage';
import EventControlPage from './pages/admin/EventControlPage';
import TeamEventsPage from './pages/admin/TeamEventsPage';
import TeamCheckinPage from './pages/admin/TeamCheckinPage';

// Layout
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { isDark } = useTheme();

  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            className: '',
            style: {
              background: isDark ? '#1f2937' : '#fff',
              color: isDark ? '#f9fafb' : '#111827',
            },
          }}
        />
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/events/:id" element={<EventDetailsPage />} />
            <Route path="/events/:id/register" element={<RegistrationPage />} />
            <Route path="/success" element={<SuccessPage />} />
            <Route path="/payment/phonepe/callback" element={<PhonePeCallbackPage />} />
          </Route>

          {/* Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />



          {/* Admin Routes */}
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/events" element={<EventListPage />} />
            <Route path="/admin/events/create" element={<CreateEventPage />} />
            <Route path="/admin/events/:id/edit" element={<EditEventPage />} />
            <Route path="/admin/events/:eventId/control" element={<EventControlPage />} />
            <Route path="/admin/events/:id/form" element={<FormBuilderPage />} />
            <Route path="/admin/events/:id/registrations" element={<RegistrationsPage />} />
            <Route path="/admin/events/:id/analytics" element={<AnalyticsPage />} />
            <Route path="/admin/events/:id/discounts" element={<DiscountCodesPage />} />
            <Route path="/admin/financials" element={<FinancialsPage />} />

            {/* Team Member Routes */}
            <Route path="/admin/team-events" element={<TeamEventsPage />} />
            <Route path="/admin/team-event/:id/checkin" element={<TeamCheckinPage />} />

            {/* Scanner - limited to admins/organizers */}
            <Route path="/scanner" element={<ScannerPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
