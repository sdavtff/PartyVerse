import { useEffect, useState } from 'react';
import { canInstall, install, isIos, isStandalone, onInstallChange } from '../lib/pwa';
import { useToast } from './Toast';
import { APK_URL, isAndroid, isNativeApp } from '../lib/platform';
import { Icon } from './Icons';

/** "Instalar app": aparece quando o navegador permite (Android/Chrome/Edge); no iPhone, mostra como fazer. */
export function InstallButton({ block = false }: { block?: boolean }) {
  const [, force] = useState(0);
  const toast = useToast();
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  if (isStandalone() || isNativeApp()) return null;
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
          ? 'btn-violet rounded-2xl px-4 py-3 text-center font-bold'
          : 'hidden items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-sm font-bold text-white hover:bg-ink-700 xl:flex'
      }
    >
      <span aria-hidden>📲</span> Instalar app
    </button>
  );
}

/** Link para baixar o app Android (.apk), mostrado só em celulares Android fora do app. */
export function AndroidAppLink({ className = '' }: { className?: string }) {
  if (isNativeApp() || !isAndroid()) return null;
  return (
    <a
      href={APK_URL}
      className={`flex items-center justify-center gap-2 rounded-2xl border border-lime-400/40 bg-violet-600/15 px-4 py-3 text-sm font-bold text-white ${className}`}
    >
      <Icon name="download" size={18} className="text-lime-300" /> Baixar o app Android
    </a>
  );
}

/** Cartão "App Android" nas configurações do perfil: baixar o APK ou ver que já está no app. */
export function AppDownloadCard() {
  const inApp = isNativeApp();
  return (
    <div className="mt-4 rounded-2xl border border-ink-700/70 bg-ink-950/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-white">📱 App Android</p>
          <p className="mt-1 max-w-md text-sm text-ink-300">
            {inApp
              ? 'Você já está usando o app. As novidades do site aparecem aqui sozinhas; baixe de novo só se avisarmos de uma versão nova do app.'
              : 'Instale o PartyVerse no celular: abre em tela cheia, com ícone próprio e chat de voz. O Android pode pedir para permitir "instalar apps desconhecidos".'}
          </p>
        </div>
        <a
          href={APK_URL}
          className="btn-violet inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          <Icon name="download" size={18} /> {inApp ? 'Baixar de novo' : 'Baixar APK'}
        </a>
      </div>
    </div>
  );
}
