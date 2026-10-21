import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, type PushState } from '../lib/push';
import { useHealth } from '../lib/health';
import { isNativeApp } from '../lib/platform';
import { Button } from './Button';
import { useToast } from './Toast';

const HINT: Record<PushState, string> = {
  on: 'Ligadas neste aparelho: convites de amigos, pedidos de amizade e o lembrete do desafio do dia.',
  off: 'Receba convites de amigos e o lembrete do desafio do dia mesmo com o site fechado.',
  denied:
    'As notificações estão bloqueadas no navegador. Libere em Configurações do site (ícone do cadeado) e tente de novo.',
  'ios-install':
    'No iPhone, primeiro instale o PartyVerse na tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá.',
  unsupported: 'Este navegador não aceita notificações.',
};

/** Ligar/desligar notificações push neste aparelho (só para contas). */
export function PushToggle() {
  const health = useHealth();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushState().then(setState);
  }, []);
  if ((health && !health.push) || isNativeApp()) return null;
  const run = (fn: () => Promise<PushState>) => {
    setBusy(true);
    fn()
      .then((s) => {
        setState(s);
        if (s === 'on') toast('Notificações ligadas! Mandamos uma de teste.', 'success');
      })
      .catch((e: Error) => toast(e.message || 'Não deu para ligar as notificações', 'error'))
      .finally(() => setBusy(false));
  };
  return (
    <div className="mt-4 rounded-2xl bg-ink-800/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">🔔 Notificações</p>
          <p className="mt-1 max-w-md text-sm text-ink-300">{state ? HINT[state] : '…'}</p>
        </div>
        {state === 'on' ? (
          <Button variant="ghost" disabled={busy} onClick={() => run(disablePush)}>
            Desligar
          </Button>
        ) : state === 'off' || state === 'denied' ? (
          <Button disabled={busy} onClick={() => run(enablePush)}>
            {busy ? 'Ligando…' : 'Ativar notificações'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
