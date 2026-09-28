import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import logoHeader from '../../assets/logo-header.png';
import logoDark from '../../assets/logodark.png';

type LoginStatus = 'idle' | 'submitting' | 'success';

export function AdminLogin() {
  const { signIn, session, isAdmin, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const logoSrc = theme === 'dark' ? logoHeader : logoDark;
  const busy = status === 'submitting';

  // Concise "no admin access" message: either from the route guard redirect,
  // or from landing here with an authenticated non-admin session.
  useEffect(() => {
    const guardDenied = Boolean((location.state as { denied?: boolean } | null)?.denied);
    if (guardDenied || (session && !isAdmin)) {
      setDenied(true);
    }
  }, [location.state, session, isAdmin]);

  // An already-authorized admin never needs the login screen.
  useEffect(() => {
    if (!authLoading && session && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [authLoading, session, isAdmin, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setError(null);
    setDenied(false);

    if (!email.trim() || !password) {
      setError('Enter both email and password to continue.');
      return;
    }

    setStatus('submitting');
    const result = await signIn(email.trim(), password);

    if (!result.ok) {
      setStatus('idle');
      setPassword('');
      setError(result.message);
      return;
    }

    // A signed-in customer is NOT an invalid user — their session stays valid
    // and they are simply denied Admin access.
    if (!isAdmin) {
      setStatus('idle');
      setPassword('');
      setDenied(true);
      return;
    }

    setStatus('success');
    navigate('/admin', { replace: true });
  };

  if (authLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-ghana-light dark:bg-ghana-dark transition-colors duration-300 lg:grid lg:grid-cols-2">
      {/* Editorial brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-ghana-black kente-pattern p-12 xl:p-16">
        <img src={theme === 'dark' ? logoHeader : logoDark} alt="The Proxy Shop" className="h-16 w-auto object-contain" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-6">Admin Console</p>
          <h1 className="font-display text-5xl xl:text-6xl leading-[1.05] text-ghana-light max-w-md">
            Curate the collection, privately.
          </h1>
          <p className="mt-6 text-sm font-ui text-ghana-light/60 max-w-sm leading-relaxed">
            Editorial commerce for modern African luxury. Access is limited to authorised
            administrators.
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-ghana-light/40">
          The Proxy Shop — Admin
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col min-h-screen lg:min-h-0 px-6 sm:px-10 lg:px-16 py-10">
        <div className="flex items-center justify-between">
          <img src={logoSrc} alt="The Proxy Shop" className="h-12 w-auto object-contain lg:hidden" />
          <span className="hidden lg:block" />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="w-10 h-10 flex items-center justify-center rounded-full border border-ghana-black/15 dark:border-white/20 text-ghana-black dark:text-white hover:border-ghana-green hover:text-ghana-green transition-colors duration-200"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <p className="text-[10px] uppercase tracking-[0.3em] text-ghana-green mb-4">Admin access</p>
            <h2 className="font-display text-4xl text-ghana-black dark:text-white mb-3">Sign in</h2>
            <p className="text-sm text-ghana-black/60 dark:text-white/60 mb-8 leading-relaxed">
              Authorised administrators only. Your role is verified against the database after
              sign-in.
            </p>

            {denied && (
              <div
                role="alert"
                className="mb-6 border-l-2 border-ghana-red pl-4 text-sm text-ghana-red flex flex-col gap-3"
              >
                <span>This account does not have Admin access.</span>
                <Link
                  to="/account"
                  className="self-start text-xs uppercase tracking-[0.16em] text-ghana-black/60 dark:text-white/60 underline underline-offset-4 hover:text-ghana-green"
                >
                  Go to your account
                </Link>
              </div>
            )}

            {error && (
              <div role="alert" className="mb-6 border-l-2 border-ghana-red pl-4 text-sm text-ghana-red">
                {error}
              </div>
            )}

            {status === 'success' && (
              <p role="status" className="mb-6 text-sm text-ghana-green">
                Access granted. Opening the dashboard…
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2"
                >
                  Email
                </label>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2"
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                aria-busy={busy}
                className="w-full px-6 py-3 bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-lg transition-all duration-300 hover:bg-ghana-black active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? 'Verifying…' : 'Sign in'}
              </button>
            </form>

            <Link
              to="/"
              className="block mt-8 text-xs uppercase tracking-[0.16em] text-ghana-black/50 dark:text-white/50 hover:text-ghana-green transition-colors duration-200"
            >
              ← Back to storefront
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
