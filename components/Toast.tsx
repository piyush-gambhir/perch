/** Toast notification with a tiny context so any component can call showToast(). */

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircleIcon } from './icons';

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 2500);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast${visible ? ' visible' : ''}`}>
        <CheckCircleIcon />
        <span>{message}</span>
      </div>
    </ToastContext.Provider>
  );
}
