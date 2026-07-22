import { toast as sonnerToast } from 'sonner';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

type ToastOptions = {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick?: () => void;
  };
};

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

function createToast(type: 'success' | 'error' | 'warning' | 'info') {
  return (message: string, options?: ToastOptions) => {
    const Icon = iconMap[type];
    return sonnerToast[type](message, {
      ...(options as Record<string, unknown>),
      icon: <Icon className="h-4 w-4" />,
      closeButton: true,
    } as never);
  };
}

export const toast = {
  success: createToast('success'),
  error: createToast('error'),
  warning: createToast('warning'),
  info: createToast('info'),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
  ) => sonnerToast.promise(promise, messages),
};

export type { ToastOptions };
