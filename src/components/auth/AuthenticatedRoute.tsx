import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../LoadingSpinner';

/**
 * Customer/session guard — deliberately separate from `AdminRoute`.
 * Any authenticated user passes; admin authorization is NOT required here.
 */
export function AuthenticatedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!session) {
    // Preserve the full destination (path + query + hash) so a return URL such
    // as /payment/callback?reference=… survives the sign-in round trip.
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Outlet />;
}
