import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'info' | 'error' | 'success';
interface Toast {
  id: number;
  text: string;
  kind: Kind;
}
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => undefined);

let seq = 0;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Kind = 'info') => {
    const id = ++seq;
    setItems((xs) => [...xs.slice(-3), { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  const colors: Record<Kind, string> = {
    info: 'border-pop-sky bg-ink-800',
    error: 'border-pop-rose bg-ink-800',
    success: 'border-lime-400 bg-ink-800',
  };
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto animate-rise rounded-2xl border-2 px-4 py-3 font-medium text-white shadow-chunky ${colors[t.kind]}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
