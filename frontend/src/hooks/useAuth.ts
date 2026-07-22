import { useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import type { LoginRequest, RegisterRequest } from '@/types';

export function useAuth() {
  const { state, login, register, logout, updateProfile, clearError } = useAuthStore();

  const loginUser = useCallback(
    async (credentials: LoginRequest) => {
      await login(credentials);
    },
    [login],
  );

  const registerUser = useCallback(
    async (data: RegisterRequest) => {
      await register(data);
    },
    [register],
  );

  const logoutUser = useCallback(async () => {
    await logout();
  }, [logout]);

  return {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    login: loginUser,
    register: registerUser,
    logout: logoutUser,
    updateProfile,
    clearError,
  };
}
