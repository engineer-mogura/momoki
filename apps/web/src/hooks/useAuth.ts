'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, clearAuthToken } from '@/lib/api';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get<{ user: User }>('/api/auth/user');
      setState({ user: response.user, isLoading: false, error: null });
    } catch {
      setState({ user: null, isLoading: false, error: null });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      // Always clear token and user state
      clearAuthToken();
      setState({ user: null, isLoading: false, error: null });
    }
  }, []);

  return {
    ...state,
    logout,
    refetch: fetchUser,
  };
}
