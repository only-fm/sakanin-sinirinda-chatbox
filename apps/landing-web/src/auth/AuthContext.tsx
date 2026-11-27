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
  email: string | null;
  tutorialCompleted: boolean;
};

type AuthContextValue = {
  session: Session | null;
  profile: AuthProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  signIn: (identifier: string, password: string, captchaToken: string) => Promise<AuthProfile>;
  saveStudentEmail: (email: string) => Promise<void>;
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
    .select('id, username, role, email, tutorial_completed')
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
    email: data.email,
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
      return nextProfile;
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

  const signIn = useCallback(async (identifier: string, password: string, captchaToken: string) => {
    if (!supabaseClient) {
      throw new Error(supabaseConfigError ?? 'Supabase bağlantısı yapılandırılmamış.');
    }
    if (!captchaToken.trim()) {
      throw new Error('Giriş için Turnstile doğrulaması gereklidir.');
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedIdentifier);
    if (normalizedIdentifier.includes('@') && (!isEmail || normalizedIdentifier.length > 254)) {
      throw new Error('Geçerli bir e-posta adresi girin.');
    }
    const isUsername = /^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalizedIdentifier);
    if (!isEmail && !isUsername) {
      throw new Error('Geçerli bir kullanıcı adı veya e-posta adresi girin.');
    }

    const email = isEmail
      ? normalizedIdentifier
      : `${normalizedIdentifier}@login.sakanin-sinirinda.invalid`;
    const { data, error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });
    if (signInError) throw signInError;
    const nextSession = data.session;

    if (!nextSession) throw new Error('Giriş başarılı oldu ancak oturum oluşturulamadı.');

    const nextProfile = await loadSession(nextSession);
    if (!nextProfile) throw new Error('Kullanıcı profili bulunamadı.');
    return nextProfile;
  }, [loadSession]);

  const saveStudentEmail = useCallback(async (email: string) => {
    if (!supabaseClient || !session) {
      throw new Error(supabaseConfigError ?? 'E-posta kaydetmek için oturum açmalısınız.');
    }
    if (profile?.role !== 'student') {
      throw new Error('Bu işlem yalnızca öğrenci hesapları için kullanılabilir.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error('Geçerli bir e-posta adresi girin.');
    }

    const { data, error: updateError } = await supabaseClient
      .from('profiles')
      .update({ email: normalizedEmail })
      .eq('id', session.user.id)
      .is('email', null)
      .select('email')
      .maybeSingle();

    if (updateError) throw new Error(`E-posta kaydedilemedi: ${updateError.message}`);
    if (!data) {
      throw new Error('E-posta kaydedilemedi. Profil zaten güncellenmiş olabilir; lütfen sayfayı yenileyin.');
    }

    setProfile((currentProfile) => currentProfile
      ? { ...currentProfile, email: data.email }
      : currentProfile);
  }, [profile?.role, session]);

  const signOut = useCallback(async () => {
    if (!supabaseClient) {
      throw new Error(supabaseConfigError ?? 'Supabase bağlantısı yapılandırılmamış.');
    }

    const { error: signOutError } = await supabaseClient.auth.signOut();
    if (signOutError) throw signOutError;
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, role, loading, error, signIn, saveStudentEmail, signOut }}>
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
