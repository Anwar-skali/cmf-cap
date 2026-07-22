import { api } from '@/api/client';
import { API_ENDPOINTS } from '@/lib/constants';
import type { LoginRequest, RegisterRequest, TokenResponse, User } from '@/types';

export function login(data: LoginRequest): Promise<TokenResponse> {
  return api.post<TokenResponse>(API_ENDPOINTS.AUTH.LOGIN, data);
}

export function register(data: RegisterRequest): Promise<User> {
  return api.post<User>(API_ENDPOINTS.AUTH.REGISTER, data);
}

export function refresh(refreshToken: string): Promise<TokenResponse> {
  return api.post<TokenResponse>(API_ENDPOINTS.AUTH.REFRESH, { refreshToken });
}

export function logout(): Promise<void> {
  const refreshToken = localStorage.getItem('cmf_refresh_token');
  return api.post<void>(
    API_ENDPOINTS.AUTH.LOGOUT,
    refreshToken ? { refreshToken } : undefined,
  );
}

export function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<void> {
  return api.post<void>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
    oldPassword: data.currentPassword,
    newPassword: data.newPassword,
    confirmPassword: data.confirmNewPassword,
  });
}

export function forgotPassword(email: string): Promise<void> {
  return api.post<void>(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
}

export function resetPassword(data: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<void> {
  return api.post<void>(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
    token: data.token,
    newPassword: data.password,
    confirmPassword: data.confirmPassword,
  });
}

export function getMe(): Promise<User> {
  return api.get<User>(API_ENDPOINTS.AUTH.ME);
}

export function updateProfile(data: Partial<User>): Promise<User> {
  return api.put<User>(API_ENDPOINTS.AUTH.ME, data);
}
