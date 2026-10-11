import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { User, UserProfileUpdate, SignUpData } from '../types';
import { INITIAL_USERS } from '../data/initialData';
import {
  supabase,
  isSupabaseConfigured,
  authSignIn,
  authSignUp,
  authSignOut,
  authResetPassword,
  authUpdateProfile,
  mapSupabaseUserToUser
} from '../services/supabase';
import {
  setUserServicesVisibilityRemote,
  fetchAdminStatusRemote
} from '../services/storage';

interface AuthContextType {
  // Real authentication state
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Active Persona (either real authenticated user or demo preview user)
  activeUser: User;
  isDemoMode: boolean;

  // Permission helpers strictly decoupled from fake local state
  canPublish: boolean;
  canModerate: boolean;

  // Auth actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: UserProfileUpdate) => Promise<{ success: boolean; error?: string }>;

  // Demo persona switching (for read-only UI inspection)
  selectDemoUser: (user: User) => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial default demo persona for unauthenticated browsing
const DEFAULT_DEMO_USER: User = INITIAL_USERS[0];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [serverIsAdmin, setServerIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);

  // Demo persona for read-only preview when not authenticated
  const [demoUser, setDemoUser] = useState<User>(() => {
    try {
      const saved = localStorage.getItem('vecinoya_preview_persona_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = INITIAL_USERS.find(u => u.id === parsed.id);
        if (match) return match;
      }
    } catch {
      // ignore
    }
    return DEFAULT_DEMO_USER;
  });

  // Listen to Supabase Auth State changes
  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // 1. Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession }, error }) => {
      if (!mounted) return;
      if (error) {
        console.warn('Error reading initial Supabase session:', error.message);
      }
      setSession(initialSession);
      if (initialSession?.user) {
        lastAuthenticatedUserIdRef.current = initialSession.user.id;
        setUser(mapSupabaseUserToUser(initialSession.user));
        const [, verifiedAdmin] = await Promise.all([
          setUserServicesVisibilityRemote(
            initialSession.user.id,
            true,
            initialSession.access_token
          ),
          fetchAdminStatusRemote(initialSession.access_token)
        ]);
        if (mounted) {
          setServerIsAdmin(Boolean(verifiedAdmin));
        }
      } else {
        setUser(null);
        setServerIsAdmin(false);
      }
      if (mounted) setIsLoading(false);
    }).catch(err => {
      console.warn('Network error checking auth session:', err);
      if (mounted) setIsLoading(false);
    });

    // 2. Auth listener for login/logout/token refresh
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      if (currentSession?.user) {
        lastAuthenticatedUserIdRef.current = currentSession.user.id;
        setUser(mapSupabaseUserToUser(currentSession.user));
        setUserServicesVisibilityRemote(
          currentSession.user.id,
          true,
          currentSession.access_token
        );
        fetchAdminStatusRemote(currentSession.access_token).then(verifiedAdmin => {
          if (mounted) {
            setServerIsAdmin(Boolean(verifiedAdmin));
          }
        });
      } else {
        const previousUserId = lastAuthenticatedUserIdRef.current;
        lastAuthenticatedUserIdRef.current = null;
        setUser(null);
        setServerIsAdmin(false);
        if (previousUserId && event === 'SIGNED_OUT') {
          setUserServicesVisibilityRemote(previousUserId, false);
        }
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Effective authenticated status: only true when there is a real session & verified user
  const isAuthenticated = Boolean(session && user && !user.isDemo);

  // Merge server-verified admin boolean with app_metadata.role (never trusting user_metadata)
  const effectiveUser = useMemo<User | null>(() => {
    if (!user) return null;
    const isVerifiedAdmin = !user.isDemo && (user.role === 'admin' || serverIsAdmin);
    return {
      ...user,
      role: isVerifiedAdmin ? 'admin' : 'user'
    };
  }, [user, serverIsAdmin]);

  // Active persona: If real user is logged in, ALWAYS use real user. Otherwise, provide demo persona.
  const activeUser = useMemo<User>(() => {
    if (isAuthenticated && effectiveUser) {
      return effectiveUser;
    }
    return demoUser;
  }, [isAuthenticated, effectiveUser, demoUser]);

  const isDemoMode = !isAuthenticated;

  // Real permission checks:
  // - Demo personas CANNOT publish or moderate
  // - Only real authenticated users can publish
  // - Only real users verified by app_metadata.role === 'admin' or serverIsAdmin can moderate
  const canPublish = isAuthenticated && Boolean(effectiveUser && !effectiveUser.isDemo);
  const canModerate = isAuthenticated && Boolean(effectiveUser && effectiveUser.role === 'admin' && !effectiveUser.isDemo);

  const selectDemoUser = (selected: User) => {
    // Only allow switching demo personas if not logged in with real account
    if (isAuthenticated) return;
    const match = INITIAL_USERS.find(u => u.id === selected.id) || selected;
    const safeDemo: User = { ...match, isDemo: true, authProvider: 'demo' };
    setDemoUser(safeDemo);
    try {
      localStorage.setItem('vecinoya_preview_persona_v2', JSON.stringify(safeDemo));
    } catch {
      // ignore
    }
  };

  const exitDemoMode = () => {
    setDemoUser(DEFAULT_DEMO_USER);
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const res = await authSignIn(email, password);
    if (res.error) {
      return { success: false, error: res.error };
    }
    if (res.user) {
      lastAuthenticatedUserIdRef.current = res.user.id;
      setUser(res.user);
    }
    if (res.session) {
      setSession(res.session);
    }
    if (res.user && res.session) {
      const [, verifiedAdmin] = await Promise.all([
        setUserServicesVisibilityRemote(res.user.id, true, res.session.access_token),
        fetchAdminStatusRemote(res.session.access_token)
      ]);
      setServerIsAdmin(Boolean(verifiedAdmin));
    }
    return { success: true };
  };

  const signUp = async (data: SignUpData): Promise<{ success: boolean; error?: string }> => {
    const res = await authSignUp(data.email, data.password, {
      name: data.name,
      neighborhood: data.neighborhood,
      city: data.city,
      phone: data.phone
    });
    if (res.error) {
      return { success: false, error: res.error };
    }
    if (res.user) {
      setUser(res.user);
    }
    if (res.session) {
      setSession(res.session);
    }
    if (res.user && res.session) {
      lastAuthenticatedUserIdRef.current = res.user.id;
      const [, verifiedAdmin] = await Promise.all([
        setUserServicesVisibilityRemote(res.user.id, true, res.session.access_token),
        fetchAdminStatusRemote(res.session.access_token)
      ]);
      setServerIsAdmin(Boolean(verifiedAdmin));
    }
    return { success: true };
  };

  const signOut = async () => {
    const currentUserId = user?.id || session?.user?.id || lastAuthenticatedUserIdRef.current;
    const currentToken = session?.access_token;
    lastAuthenticatedUserIdRef.current = null;
    setServerIsAdmin(false);

    // Crucial: Pause user's services in Supabase and purge from public cache BEFORE revoking the Auth session JWT
    if (currentUserId) {
      await setUserServicesVisibilityRemote(currentUserId, false, currentToken);
    }

    await authSignOut();
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const res = await authResetPassword(email);
    if (res.error) {
      return { success: false, error: res.error };
    }
    return { success: true };
  };

  const updateProfile = async (updates: UserProfileUpdate): Promise<{ success: boolean; error?: string }> => {
    if (!isAuthenticated) {
      return { success: false, error: 'Debes iniciar sesión con una cuenta real para modificar tu perfil.' };
    }
    const res = await authUpdateProfile(updates);
    if (res.error) {
      return { success: false, error: res.error };
    }
    if (res.user) {
      setUser(res.user);
    }
    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        session,
        isAuthenticated,
        isLoading,
        activeUser,
        isDemoMode,
        canPublish,
        canModerate,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile,
        selectDemoUser,
        exitDemoMode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
