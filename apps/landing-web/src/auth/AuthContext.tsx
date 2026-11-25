import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabaseClient, supabaseConfigError } from '../supabaseClient';

export type UserRole = 'student' | 'expert' | 'admin';
export type AuthProfile = {
  id: string;
  username: string;
  role: UserRole;
  tutorialCompleted: boolean;
};

type AuthContextValue = {
  session: Session | null;
  profile: AuthProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<UserRole>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Beklenmeyen bir kimlik doğrulama hatası oluştu.';
}

async function fetchUserProfile(userId: string): Promise<AuthProfile> {
  if (!supabaseClient) {
    throw new Error(supabaseConfigError ?? 'Supabase bağlantısı yapılandırılmamış.');
  }

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, username, role, tutorial_completed')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kullanıcı rolü okunamadı: ${error.message}`);
  }
  if (!data) {
    throw new Error('Bu kullanıcı için profiles tablosunda rol kaydı bulunamadı.');
  }
  if (data.role !== 'student' && data.role !== 'expert' && data.role !== 'admin') {
    throw new Error('Kullanıcı rolü student, expert veya admin olmalıdır.');
  }

  return {
    id: data.id,
    username: data.username,
    role: data.role,
    tutorialCompleted: data.tutorial_completed,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadSession = useCallback(async (nextSession: Session | null) => {
    const currentRequestId = ++requestId.current;
    setSession(nextSession);
    setProfile(null);
    setRole(null);
    setError(null);

    if (!nextSession) {
      setLoading(false);
      return null;
    }

    setLoading(true);
    try {
      const nextProfile = await fetchUserProfile(nextSession.user.id);
      if (requestId.current === currentRequestId) {
        setProfile(nextProfile);
        setRole(nextProfile.role);
      }
      return nextProfile.role;
    } catch (loadError) {
      if (requestId.current === currentRequestId) {
        setError(getErrorMessage(loadError));
      }
      throw loadError;
    } finally {
      if (requestId.current === currentRequestId) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (!supabaseClient) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        if (active) {
          void loadSession(nextSession).catch(() => undefined);
        }
      });
    });

    void supabaseClient.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setError(`Oturum kontrol edilemedi: ${sessionError.message}`);
          setLoading(false);
          return;
        }
        return loadSession(data.session).catch(() => undefined);
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setError(`Oturum kontrol edilemedi: ${getErrorMessage(sessionError)}`);
          setLoading(false);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
      requestId.current += 1;
    };
  }, [loadSession]);

  const signIn = useCallback(async (identifier: string, password: string) => {
    if (!supabaseClient) {
      throw new Error(supabaseConfigError ?? 'Supabase bağlantısı yapılandırılmamış.');
    }

    const trimmedIdentifier = identifier.trim().toLowerCase();
    const email = trimmedIdentifier.includes('@')
      ? trimmedIdentifier
      : `${trimmedIdentifier}@login.sakanin-sinirinda.invalid`;
    const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;
    if (!data.session) throw new Error('Giriş başarılı oldu ancak oturum oluşturulamadı.');

    const nextRole = await loadSession(data.session);
    if (!nextRole) throw new Error('Kullanıcı rolü bulunamadı.');
    return nextRole;
  }, [loadSession]);

  const signOut = useCallback(async () => {
    if (!supabaseClient) {
      throw new Error(supabaseConfigError ?? 'Supabase bağlantısı yapılandırılmamış.');
    }

    const { error: signOutError } = await supabaseClient.auth.signOut();
    if (signOutError) throw signOutError;
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, role, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  }
  return context;
}
