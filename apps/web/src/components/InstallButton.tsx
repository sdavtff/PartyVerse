import { useEffect, useState } from 'react';
import { canInstall, install, isIos, isStandalone, onInstallChange } from '../lib/pwa';
import { useToast } from './Toast';

/** "Instalar app": aparece quando o navegador permite (Android/Chrome/Edge); no iPhone, mostra como fazer. */
export function InstallButton({ block = false }: { block?: boolean }) {
  const [, force] = useState(0);
  const toast = useToast();
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  if (isStandalone()) return null;
  const ios = isIos();
  if (!canInstall() && !ios) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (ios) {
          toast('No iPhone: toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início".');
          return;
        }
        if (await install())
          toast('PartyVerse instalado! Procure o ícone na tela inicial.', 'success');
      }}
      className={
        block
          ? 'rounded-2xl bg-lime-400 px-4 py-3 text-center font-bold text-night'
          : 'hidden items-center gap-1.5 rounded-xl bg-ink-800 px-3 py-2 text-sm font-bold text-white hover:bg-ink-700 lg:flex'
      }
    >
      <span aria-hidden>📲</span> Instalar app
    </button>
  );
}
