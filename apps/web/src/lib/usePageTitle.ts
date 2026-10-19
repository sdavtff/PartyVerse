import { useEffect } from 'react';

/** Título da aba do navegador para cada página. */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · PartyVerse` : 'PartyVerse · jogos para jogar junto';
  }, [title]);
}
