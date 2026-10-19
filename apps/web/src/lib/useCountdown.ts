import { useEffect, useState } from 'react';
import { clockSkew } from './clock';

/** Segundos restantes até um prazo definido pelo servidor (corrigindo a diferença de relógio). */
export function useCountdown(deadline: number | null) {
  const calc = () =>
    deadline ? Math.max(0, Math.ceil((deadline - (Date.now() + clockSkew())) / 1000)) : 0;
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!deadline) return;
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);
  return left;
}
