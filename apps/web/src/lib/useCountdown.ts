import { useEffect, useState } from 'react';

/** Segundos restantes até um prazo definido pelo servidor. */
export function useCountdown(deadline: number | null, skew = 0) {
  const calc = () =>
    deadline ? Math.max(0, Math.ceil((deadline - (Date.now() + skew)) / 1000)) : 0;
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!deadline) return;
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, skew]);
  return left;
}
