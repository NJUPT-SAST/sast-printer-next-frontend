import { createContext, useContext } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  danger?: boolean;
}

export interface UiContextType {
  toast: (options: ToastOptions | string) => void;
  confirm: (options: ConfirmOptions) => void;
}

export const UiContext = createContext<UiContextType | undefined>(undefined);

export function useUi() {
  const context = useContext(UiContext);
  if (!context) throw new Error('useUi must be used within UiProvider');
  return context;
}
