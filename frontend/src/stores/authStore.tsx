import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode } from 'react';
import type { User, AuthState, LoginRequest, RegisterRequest } from '@/types';
import * as authApi from '@/api/endpoints/auth';

const TOKEN_KEY = 'cmf_access_token';
const REFRESH_TOKEN_KEY = 'cmf_refresh_token';

type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; accessToken: string; refreshToken: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean };

function getInitialState(): AuthState {
  const hasToken = !!localStorage.getItem(TOKEN_KEY);
  return {
    user: null,
    accessToken: hasToken ? localStorage.getItem(TOKEN_KEY) : null,
    refreshToken: hasToken ? localStorage.getItem(REFRESH_TOKEN_KEY) : null,
    isAuthenticated: false,
    isLoading: hasToken,
    error: null,
  };
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

interface AuthContextValue {
  state: AuthState;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokenAction: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, undefined, getInitialState);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    authApi.getMe()
      .then((user) => {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user,
            accessToken: localStorage.getItem(TOKEN_KEY) ?? '',
            refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY) ?? '',
          },
        });
      })
      .catch(async (err: any) => {
        const status = err?.statusCode ?? err?.status ?? 0;
        // Try to silently refresh if the access token is expired (401)
        if (status === 401) {
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
          if (refreshToken) {
            try {
              const response = await authApi.refresh(refreshToken);
              localStorage.setItem(TOKEN_KEY, response.accessToken);
              localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
              const user = await authApi.getMe();
              dispatch({
                type: 'AUTH_SUCCESS',
                payload: {
                  user,
                  accessToken: response.accessToken,
                  refreshToken: response.refreshToken,
                },
              });
              return;
            } catch {
              // Refresh also failed — fall through to logout
            }
          }
        }
        // Token is invalid/expired with no valid refresh — log out and redirect
        clearTokens();
        dispatch({ type: 'LOGOUT' });
      });
  }, []);

  useEffect(() => {
    function handleAuthLogout() {
      clearTokens();
      dispatch({ type: 'LOGOUT' });
    }

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const response = await authApi.login(credentials);
      storeTokens(response.accessToken, response.refreshToken);
      const user = await authApi.getMe();
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, accessToken: response.accessToken, refreshToken: response.refreshToken },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw error;
    }
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    dispatch({ type: 'AUTH_START' });
    try {
      await authApi.register(data);
      const response = await authApi.login({ email: data.email, password: data.password });
      storeTokens(response.accessToken, response.refreshToken);
      const user = await authApi.getMe();
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, accessToken: response.accessToken, refreshToken: response.refreshToken },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    } finally {
      clearTokens();
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  const refreshTokenAction = useCallback(async () => {
    const currentRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!currentRefreshToken) {
      dispatch({ type: 'LOGOUT' });
      return;
    }
    try {
      const response = await authApi.refresh(currentRefreshToken);
      storeTokens(response.accessToken, response.refreshToken);
    } catch {
      clearTokens();
      dispatch({ type: 'LOGOUT' });
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<User>) => {
    const user = await authApi.updateProfile(data);
    dispatch({ type: 'SET_USER', payload: user });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return (
    <AuthContext.Provider
      value={{ state, login, register, logout, refreshTokenAction, updateProfile, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthStore() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthStore must be used within an AuthProvider');
  }
  return context;
}
