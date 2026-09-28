import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

type Feedback = { status: 'saved' | 'error'; message: string } | null;

/**
 * Profile (Phase D3) — editable: full name + phone. Read-only: email.
 * Role is internal authorization data and is never shown as a customer field.
 */
export function AccountProfile() {
  const { user, profile, profileError, updateProfile, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? '');
    setPhone(profile.phone ?? '');
  }, [profile]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setFeedback(null);
    setSaving(true);
    const result = await updateProfile({ fullName, phone });
    setSaving(false);

    if (!result.ok) {
      setFeedback({ status: 'error', message: result.message });
      return;
    }

    setFeedback({ status: 'saved', message: 'Your details are saved.' });
    setEditing(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="font-display text-4xl text-ghana-black sm:text-5xl dark:text-white">Profile</h1>
      <p className="mt-3 text-sm text-ghana-black/60 dark:text-white/60">
        Update the details we keep on file for you.
      </p>

      {feedback && (
        <p
          role={feedback.status === 'error' ? 'alert' : 'status'}
          className={`mt-8 text-sm ${
            feedback.status === 'error' ? 'text-ghana-red' : 'text-ghana-green'
          }`}
        >
          {feedback.message}
        </p>
      )}

      {profileError && (
        <div
          role="alert"
          className="mt-8 rounded-lg border border-ghana-black/10 p-5 text-sm text-ghana-black/70 dark:border-white/10 dark:text-white/70"
        >
          <p>{profileError}</p>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="mt-3 text-xs uppercase tracking-[0.16em] text-ghana-green hover:text-ghana-black dark:hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      <div className="mt-8 rounded-lg border border-ghana-black/10 p-5 sm:p-6 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl text-ghana-black dark:text-white">Your details</h2>
            <p className="mt-1 text-sm text-ghana-black/60 dark:text-white/60">
              Email cannot be changed here yet.
            </p>
          </div>

          {!editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setFeedback(null);
              }}
              className="rounded-lg border border-ghana-black/15 px-4 py-2.5 text-xs uppercase tracking-[0.16em] text-ghana-black transition-colors duration-200 hover:border-ghana-green hover:text-ghana-green dark:border-white/20 dark:text-white"
            >
              Edit profile
            </button>
          )}
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
              Email
            </dt>
            <dd className="mt-1 break-all text-ghana-black dark:text-white">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
              Full name
            </dt>
            <dd className="mt-1 text-ghana-black dark:text-white">{profile?.fullName || '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50">
              Phone
            </dt>
            <dd className="mt-1 text-ghana-black dark:text-white">{profile?.phone || '—'}</dd>
          </div>
        </dl>

        {editing && (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5 border-t border-ghana-black/10 pt-6 dark:border-white/10"
          >
            <div>
              <label
                htmlFor="profile-name"
                className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50"
              >
                Full name
              </label>
              <input
                id="profile-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={saving}
                className="input-field"
                placeholder="Your name"
              />
            </div>

            <div>
              <label
                htmlFor="profile-phone"
                className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-ghana-black/50 dark:text-white/50"
              >
                Phone
              </label>
              <input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={saving}
                className="input-field"
                placeholder="+233 20 000 0000"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                aria-busy={saving}
                className="rounded-lg bg-ghana-green px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition-colors duration-200 hover:bg-ghana-black disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save details'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setFullName(profile?.fullName ?? '');
                  setPhone(profile?.phone ?? '');
                  setFeedback(null);
                }}
                disabled={saving}
                className="text-xs uppercase tracking-[0.16em] text-ghana-black/60 hover:text-ghana-green disabled:opacity-50 dark:text-white/60"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
}
