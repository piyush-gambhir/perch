/** Toast notification with a tiny context so any component can call showToast().
 *  An optional action (e.g. Undo) renders an inline button. */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircleIcon } from './icons';

type ShowToast = (message: string, onAction?: () => void, actionLabel?: string) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

interface ToastState {
  message: string;
  onAction?: () => void;
  actionLabel: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', actionLabel: 'Undo' });
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback<ShowToast>((message, onAction, actionLabel = 'Undo') => {
    setToast({ message, onAction, actionLabel });
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    // Give actionable toasts longer to be clicked.
    timer.current = setTimeout(() => setVisible(false), onAction ? 6000 : 2500);
  }, []);

  const hide = () => {
    setVisible(false);
    if (timer.current) clearTimeout(timer.current);
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className={`toast${visible ? ' visible' : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <CheckCircleIcon className="toast-icon" />
        <span>{toast.message}</span>
        {toast.onAction && (
          <button
            className="toast-action"
            onClick={() => {
              toast.onAction?.();
              hide();
            }}
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}
