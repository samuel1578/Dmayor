import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AuthShell } from '../../components/auth/AuthShell';

const MIN_PASSWORD_LENGTH = 8;

export function CustomerSignup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await signUp({ fullName: fullName.trim(), email: email.trim(), password });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    // Email confirmation may be enabled or disabled in Supabase Auth config —
    // handle both without assuming a session exists.
    if (result.needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }

    navigate('/account', { replace: true });
  };

  if (confirmationSent) {
    return (
      <AuthShell
        eyebrow="Account"
        title="Check your email"
        description={`We've sent a confirmation link to ${email.trim()}. Confirm your address to finish setting up your account.`}
        footer={
          <p className="text-sm text-ghana-black/60 dark:text-white/60">
            Already confirmed?{' '}
            <Link
              to="/login"
              className="text-ghana-green underline underline-offset-4 hover:text-ghana-black dark:hover:text-white"
            >
              Sign in
            </Link>
          </p>
        }
      >
        <div className="border-l-2 border-ghana-green pl-4 text-sm text-ghana-black/70 dark:text-white/70 leading-relaxed">
          Nothing arrived? Check your spam folder, then try signing in once — your account may
          already be active.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      eyebrow="Account"
      title="Create account"
      description="Save your details once and pick up where you left off."
      footer={
        <p className="text-sm text-ghana-black/60 dark:text-white/60">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-ghana-green underline underline-offset-4 hover:text-ghana-black dark:hover:text-white"
          >
            Sign in
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
            htmlFor="signup-name"
            className="block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2"
          >
            Full name
          </label>
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={submitting}
            className="input-field"
            placeholder="Ama Mensah"
          />
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2"
          >
            Email
          </label>
          <input
            id="signup-email"
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
            htmlFor="signup-password"
            className="block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2"
          >
            Password
          </label>
          <input
            id="signup-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="input-field"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
        </div>

        <div>
          <label
            htmlFor="signup-confirm"
            className="block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50 mb-2"
          >
            Confirm password
          </label>
          <input
            id="signup-confirm"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
            className="input-field"
            placeholder="Repeat your password"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="w-full px-6 py-3 bg-ghana-green text-white text-xs font-semibold uppercase tracking-[0.2em] rounded-lg transition-all duration-300 hover:bg-ghana-black active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-xs text-ghana-black/50 dark:text-white/50 leading-relaxed">
          Phone number can be added later from your account.
        </p>
      </form>
    </AuthShell>
  );
}
