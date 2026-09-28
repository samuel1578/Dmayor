import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AuthShell } from '../../components/auth/AuthShell';
import { LoadingSpinner } from '../../components/LoadingSpinner';

interface LocationState {
  from?: string;
}

export function CustomerLogin() {
  const { signIn, session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = (location.state as LocationState | null)?.from || '/account';

  // Already signed in (e.g. after a refresh) — no need for the form.
  useEffect(() => {
    if (!loading && session) {
      navigate(redirectTo, { replace: true });
    }
  }, [loading, session, navigate, redirectTo]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(null);

    if (!email.trim() || !password) {
      setError('Enter both email and password to continue.');
      return;
    }

    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);

    if (!result.ok) {
      setPassword('');
      setError(result.message);
      return;
    }

    navigate(redirectTo, { replace: true });
  };

  if (loading) return <LoadingSpinner />;

  return (
    <AuthShell
      eyebrow="Account"
      title="Sign in"
      description="Welcome back. Sign in to continue to your account."
      footer={
        <p className="text-sm text-ghana-black/60 dark:text-white/60">
          New here?{' '}
          <Link
            to="/signup"
            state={{ from: redirectTo }}
            className="text-ghana-green underline underline-offset-4 hover:text-ghana-black dark:hover:text-white"
          >
            Create an account
          </Link>
        </p>
      }
    >
      {error && (
        <div role="alert" className="mb-6 border-l-2 border-ghana-red pl-4 text-sm text-ghana-red">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label
            htmlFor="customer-email"
            className="block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2"
          >
            Email
          </label>
          <input
            id="customer-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="input-field"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="customer-password"
            className="block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2"
          >
            Password
          </label>
          <input
            id="customer-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="input-field"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="w-full px-6 py-3 bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-lg transition-all duration-300 hover:bg-ghana-black active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}
