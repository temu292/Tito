import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { User, UserProfileUpdate, SignUpData } from '../types';
import {
  supabase,
  isSupabaseConfigured,
  ensureSupabaseClient,
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

  // Active User (either real authenticated user or anonymous guest visitor)
  activeUser: User;

  // Permission helpers strictly verified against real authentication
  canPublish: boolean;
  canModerate: boolean;

  // Auth actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: UserProfileUpdate) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Neutral anonymous visitor representation when no session is active
export const GUEST_USER: User = {
  id: 'guest_anonymous',
  name: 'Visitante',
  email: '',
  avatar: '',
  neighborhood: '',
  city: 'Madrid',
  bio: '',
  phone: '',
  role: 'user',
  joinedDate: '',
  isDemo: false
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [serverIsAdmin, setServerIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const lastAuthenticatedUserIdRef = useRef<string | null>(null);

  // Listen to Supabase Auth State changes
  useEffect(() => {
    let mounted = true;
    let subscriptionCleanup: (() => void) | null = null;

    async function initAuth() {
      const client = (isSupabaseConfigured && supabase) ? supabase : await ensureSupabaseClient();
      if (!mounted) return;

      if (!client) {
        setIsLoading(false);
        return;
      }

      // 1. Initial session check
      try {
        const { data: { session: initialSession }, error } = await client.auth.getSession();
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
      } catch (err) {
        console.warn('Network error checking auth session:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }

      // 2. Auth listener for login/logout/token refresh
      const {
        data: { subscription }
      } = client.auth.onAuthStateChange((event, currentSession) => {
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

      subscriptionCleanup = () => subscription.unsubscribe();
    }

    initAuth();

    return () => {
      mounted = false;
      if (subscriptionCleanup) {
        subscriptionCleanup();
      }
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

  // Active user: If real user is logged in, use real user. Otherwise, provide neutral anonymous guest.
  const activeUser = useMemo<User>(() => {
    if (isAuthenticated && effectiveUser) {
      return effectiveUser;
    }
    return GUEST_USER;
  }, [isAuthenticated, effectiveUser]);

  // Real permission checks:
  // - Only real authenticated users can publish
  // - Only real users verified by app_metadata.role === 'admin' or serverIsAdmin can moderate
  const canPublish = isAuthenticated && Boolean(effectiveUser && !effectiveUser.isDemo);
  const canModerate = isAuthenticated && Boolean(effectiveUser && effectiveUser.role === 'admin' && !effectiveUser.isDemo);

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
        canPublish,
        canModerate,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateProfile
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
