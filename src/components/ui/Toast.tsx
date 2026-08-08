import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastApi {
  toast: (message: string) => void;
}

const Ctx = createContext<ToastApi>({ toast: () => {} });

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((m: string) => {
    setMessage(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3600);
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* aria-live で読み上げにも届かせる。視覚だけの通知にしない */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-lg z-[70] flex justify-center px-md"
      >
        {message ? (
          <div className="max-w-[520px] rounded-md bg-surface-dark px-lg py-sm text-ui-base text-on-dark shadow-raised">
            {message}
          </div>
        ) : null}
      </div>
    </Ctx.Provider>
  );
}
