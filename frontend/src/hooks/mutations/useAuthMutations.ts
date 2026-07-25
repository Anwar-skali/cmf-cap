import { useMutation } from '@tanstack/react-query';
import * as authApi from '@/api/endpoints/auth';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/stores/authStore';

import { RegisterRequest } from '@/types';

export function useLoginMutation() {
  const { login } = useAuthStore();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) => login(data),
    onError: (error: Error) => {
      toast.error(error.message || 'Login failed');
    },
  });
}

export function useRegisterMutation() {
  const { register } = useAuthStore();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: RegisterRequest) => register(data),

    onSuccess: () => {
      toast.success('Registration successful');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Registration failed');
    },
  });
}

export function useChangePasswordMutation() {
  const toast = useToast();

  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string; confirmNewPassword: string }) =>
      authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to change password');
    },
  });
}

export function useForgotPasswordMutation() {
  const toast = useToast();

  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () => {
      toast.success('Password reset email sent');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send reset email');
    },
  });
}

export function useResetPasswordMutation() {
  const toast = useToast();

  return useMutation({
    mutationFn: (data: { token: string; password: string; confirmPassword: string }) => authApi.resetPassword(data),
    onSuccess: () => {
      toast.success('Password reset successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reset password');
    },
  });
}

export function useUpdateProfileMutation() {
  const { updateProfile } = useAuthStore();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string; avatar?: string }) =>
      updateProfile(data),
    onSuccess: () => {
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });
}
