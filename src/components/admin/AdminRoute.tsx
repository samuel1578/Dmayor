import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../LoadingSpinner';

/**
 * Guard for every /admin route. Direct URL access is protected here, not by
 * hiding links. While the session/admin role is still resolving we render a
 * deliberate loading state instead of protected content.
 */
export function AdminRoute() {
  const { session, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ denied: true }} />;
  }

  return <Outlet />;
}
