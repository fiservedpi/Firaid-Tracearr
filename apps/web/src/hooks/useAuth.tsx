import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@tracearr/shared';
import { api, tokenStorage } from '@/lib/api';

interface UserProfile extends AuthUser {
  email: string | null;
  thumbUrl: string | null;
  trustScore: number;
  hasPassword?: boolean;
  hasPlexLinked?: boolean;
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: userData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      // Don't even try if no token
      if (!tokenStorage.getAccessToken()) {
        return null;
      }
      try {
        const user = await api.auth.me();
        // Return full user profile including thumbUrl
        return {
          userId: user.userId ?? user.id ?? '',
          username: user.username,
          role: user.role ?? (user.isOwner ? 'owner' : 'guest'),
          serverIds: user.serverIds ?? (user.serverId ? [user.serverId] : []),
          email: user.email ?? null,
          thumbUrl: user.thumbUrl ?? null,
          trustScore: user.trustScore ?? 100,
          hasPassword: user.hasPassword,
          hasPlexLinked: user.hasPlexLinked,
        } as UserProfile;
      } catch {
        // Token invalid, clear it
        tokenStorage.clearTokens();
        return null;
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } catch {
        // Ignore API errors - we're logging out anyway
      } finally {
        tokenStorage.clearTokens();
      }
    },
    onSettled: () => {
      // Always redirect, whether success or failure
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
      window.location.href = '/login';
    },
  });

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: userData ?? null,
      isLoading,
      isAuthenticated: !!userData,
      logout,
      refetch,
    }),
    [userData, isLoading, logout, refetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for protected routes
export function useRequireAuth(): AuthContextValue {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
    }
  }, [auth.isLoading, auth.isAuthenticated]);

  return auth;
}
