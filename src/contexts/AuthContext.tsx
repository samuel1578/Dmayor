import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * One shared auth/session source of truth for the whole app.
 *
 * Authenticated customer → stays signed in, `isAdmin = false`
 * Authenticated admin    → stays signed in, `isAdmin = true`
 * Unauthenticated        → no session
 *
 * Admin authorization is decided ONLY by the database (`public.is_admin()`),
 * never by the session, metadata or the profile row's role label.
 */

export interface CustomerProfile {
  id: string;
  fullName: string | null;
  phone: string | null;
  /** Convenience label from the database row — not the admin authority. */
  role: string;
  createdAt: string;
  updatedAt: string;
}

export type AuthResult = { ok: true } | { ok: false; message: string };
export type SignUpResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; message: string };

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
}

export interface ProfileUpdateInput {
  fullName: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: CustomerProfile | null;
  isAdmin: boolean;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* -------------------------------------------------------------------------- */
/* Error copy                                                                 */
/* -------------------------------------------------------------------------- */

function describeAuthError(message: string, fallback: string): string {
  const raw = message.toLowerCase();
  if (raw.includes('invalid') || raw.includes('credentials')) return 'Invalid email or password.';
  if (raw.includes('already registered') || raw.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (raw.includes('password') && raw.includes('least')) {
    return 'That password is too short. Use at least 8 characters.';
  }
  if (raw.includes('email') && raw.includes('valid')) return 'Enter a valid email address.';
  if (raw.includes('fetch') || raw.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  if (raw.includes('jwt') || raw.includes('token is expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  return fallback;
}

/* -------------------------------------------------------------------------- */
/* Database reads                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Authoritative admin check. Any failure (RPC error, unexpected value, network
 * error) denies admin access — fail closed.
 */
async function fetchIsAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.error('Admin authorization check failed:', error.message);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error('Admin authorization check failed:', err);
    return false;
  }
}

async function fetchProfile(userId: string): Promise<{ profile: CustomerProfile | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Profile load failed:', error.message);
      return { profile: null, error: 'We could not load your profile details.' };
    }
    if (!data) {
      return { profile: null, error: 'Your profile is not available yet.' };
    }

    return {
      profile: {
        id: String(data.id),
        fullName: (data.full_name as string | null) ?? null,
        phone: (data.phone as string | null) ?? null,
        role: (data.role as string | null) ?? 'customer',
        createdAt: String(data.created_at ?? ''),
        updatedAt: String(data.updated_at ?? ''),
      },
      error: null,
    };
  } catch (err) {
    console.error('Profile load failed:', err);
    return { profile: null, error: 'We could not load your profile details.' };
  }
}

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const activeRef = useRef(true);

  /**
   * Resolves a session into full auth state (session + profile + admin role).
   * `loading` only clears once everything is known, so guards never render
   * protected content or mis-redirect while a check is in flight.
   */
  const resolveSession = useCallback(async (nextSession: Session | null) => {
    if (!activeRef.current) return;
    setSession(nextSession);

    const userId = nextSession?.user?.id;
    if (!userId) {
      setProfile(null);
      setProfileError(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const [admin, profileResult] = await Promise.all([fetchIsAdmin(), fetchProfile(userId)]);
    if (!activeRef.current) return;

    setIsAdmin(admin);
    setProfile(profileResult.profile);
    setProfileError(profileResult.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    activeRef.current = true;

    // Restores the persisted session on load (and after a refresh).
    void supabase.auth.getSession().then(({ data }) => {
      void resolveSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // INITIAL_SESSION is already covered by getSession() above.
      if (event === 'INITIAL_SESSION') return;
      // Deferred: Supabase advises against awaiting other client calls
      // directly inside this callback (it can deadlock the auth lock).
      setTimeout(() => {
        void resolveSession(nextSession);
      }, 0);
    });

    return () => {
      activeRef.current = false;
      data.subscription.unsubscribe();
    };
  }, [resolveSession]);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    const result = await fetchProfile(userId);
    setProfile(result.profile);
    setProfileError(result.error);
  }, [session]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('Sign-in failed:', error.message);
        return { ok: false, message: describeAuthError(error.message, 'We could not sign you in. Please try again.') };
      }

      // Resolve immediately so callers can rely on `isAdmin`/`profile` right away.
      await resolveSession(data.session ?? null);
      return { ok: true };
    },
    [resolveSession],
  );

  const signUp = useCallback(async (input: SignUpInput): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { full_name: input.fullName } },
    });

    if (error) {
      console.error('Sign-up failed:', error.message);
      return {
        ok: false,
        message: describeAuthError(error.message, 'We could not create your account. Please try again.'),
      };
    }

    // With email confirmation disabled Supabase returns a session immediately.
    if (!data.session) {
      return { ok: true, needsEmailConfirmation: true };
    }

    await resolveSession(data.session);

    // Keep the name the customer typed if the signup trigger left it empty.
    if (data.user) {
      try {
        await supabase
          .from('profiles')
          .update({ full_name: input.fullName })
          .eq('id', data.user.id)
          .is('full_name', null);
        await refreshProfile();
      } catch (err) {
        console.error('Could not store the signup name on the profile:', err);
      }
    }

    return { ok: true, needsEmailConfirmation: false };
  }, [resolveSession, refreshProfile]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Sign-out failed:', error.message);
    } catch (err) {
      console.error('Sign-out failed:', err);
    } finally {
      setSession(null);
      setProfile(null);
      setProfileError(null);
      setIsAdmin(false);
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput): Promise<AuthResult> => {
      const userId = session?.user?.id;
      if (!userId) return { ok: false, message: 'Please sign in again to update your details.' };

      const fullName = input.fullName.trim();
      if (!fullName) return { ok: false, message: 'Your name is required.' };

      const phone = input.phone.trim();
      if (phone && !/^[0-9+()\s-]{6,20}$/.test(phone)) {
        return { ok: false, message: 'Enter a valid phone number, or leave it blank.' };
      }

      // Only the two customer-editable columns are ever written; `role` is
      // neither granted to the client nor accepted by the guard trigger.
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, phone: phone || null })
        .eq('id', userId);

      if (error) {
        console.error('Profile update failed:', error.message);
        return { ok: false, message: 'We could not save your details. Please try again.' };
      }

      await refreshProfile();
      return { ok: true };
    },
    [session, refreshProfile],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      isAdmin,
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [
      session,
      profile,
      isAdmin,
      loading,
      profileError,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
