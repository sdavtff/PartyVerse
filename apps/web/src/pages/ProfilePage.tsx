import { GAME_CATALOG } from '@partyverse/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { AvatarEditor } from '../components/AvatarEditor';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { api, type Identity } from '../lib/api';
import { usePrefs } from '../lib/prefs';
import { useSession } from '../lib/session';

interface Stats {
  matchesPlayed: number;
  wins: number;
  totalScore: number;
  bestScore: number;
}
interface HistoryItem {
  matchId: string;
  gameId: string;
  endedAt: string;
  score: number;
  place: number;
  players: number;
}

export function ProfilePage() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const { prefs, setPref } = usePrefs();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nick, setNick] = useState(user?.nickname ?? '');
  const [avatar, setAvatar] = useState(user?.avatar ?? 'blob-1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ stats: Stats | null }>('/me/profile')
      .then((r) => setStats(r.stats))
      .catch(() => undefined);
    api<HistoryItem[]>('/me/history')
      .then(setHistory)
      .catch(() => undefined);
  }, []);

  if (!user)
    return (
      <div className="p-16 text-center">
        Faça{' '}
        <Link className="font-bold text-lime-400" to="/entrar">
          login
        </Link>{' '}
        para ver seu perfil.
      </div>
    );

  const save = async () => {
    setSaving(true);
    try {
      const r = await api<{ user: Identity }>('/me/profile', {
        method: 'PATCH',
        json: { nickname: nick, avatar },
      });
      setUser(r.user);
      toast('Perfil salvo', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const pref = (k: 'sound' | 'reducedMotion', label: string) => (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-ink-900 px-4 py-3">
      <span className="font-medium text-white">{label}</span>
      <input
        type="checkbox"
        className="h-5 w-5 accent-lime-400"
        checked={prefs[k]}
        onChange={(e) => void setPref(k, e.target.checked)}
      />
    </label>
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-5 px-4 py-8 md:grid-cols-[1fr_1.2fr]">
      <section className="card p-6">
        <div className="flex items-center gap-4">
          <Avatar avatar={avatar} size={80} />
          <div>
            <h1 className="text-2xl font-extrabold">{user.nickname}</h1>
            <p className="text-sm text-ink-400">
              {user.isGuest
                ? 'Convidado — crie uma conta para guardar estatísticas'
                : 'Conta registrada'}
            </p>
          </div>
        </div>
        <label className="label mt-6" htmlFor="pnick">
          Apelido
        </label>
        <input
          id="pnick"
          className="input"
          maxLength={20}
          value={nick}
          onChange={(e) => setNick(e.target.value)}
        />
        <p className="label mt-5">Crie seu avatar</p>
        <AvatarEditor value={avatar} onChange={setAvatar} compact />
        <Button className="mt-6 w-full" onClick={() => save()} disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar perfil'}
        </Button>
        {user.isGuest && (
          <Link
            to="/entrar"
            className="mt-3 block text-center text-sm font-bold text-lime-400 hover:underline"
          >
            Criar conta
          </Link>
        )}
      </section>

      <div className="space-y-5">
        <section className="card p-6" aria-labelledby="stats-title">
          <h2 id="stats-title" className="text-xl font-extrabold">
            Estatísticas
          </h2>
          {stats ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Partidas', stats.matchesPlayed],
                ['Vitórias', stats.wins],
                ['Pontos', stats.totalScore],
                ['Recorde', stats.bestScore],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-ink-900 p-3 text-center">
                  <dt className="text-xs text-ink-400">{k}</dt>
                  <dd className="font-display text-2xl font-extrabold text-lime-400">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-ink-400">Disponível para contas registradas.</p>
          )}
        </section>

        <section className="card p-6" aria-labelledby="prefs-title">
          <h2 id="prefs-title" className="text-xl font-extrabold">
            Preferências
          </h2>
          <div className="mt-4 space-y-2">
            {pref('sound', 'Efeitos sonoros')}
            {pref('reducedMotion', 'Reduzir animações')}
          </div>
          {user.isGuest && (
            <p className="mt-2 text-xs text-ink-400">
              Como convidado, as preferências ficam salvas só neste navegador.
            </p>
          )}
        </section>

        <section className="card p-6" aria-labelledby="hist-title">
          <h2 id="hist-title" className="text-xl font-extrabold">
            Histórico
          </h2>
          {history.length === 0 ? (
            <p className="mt-3 text-ink-400">Nenhuma partida registrada ainda.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {history.map((h) => (
                <li
                  key={h.matchId}
                  className="flex items-center justify-between rounded-2xl bg-ink-900 px-4 py-2.5 text-sm"
                >
                  <span className="font-bold text-white">
                    {GAME_CATALOG.find((g) => g.id === h.gameId)?.name ?? h.gameId}
                  </span>
                  <span className="text-ink-400">
                    {new Date(h.endedAt).toLocaleDateString('pt-BR')}
                  </span>
                  <span>
                    {h.place}º de {h.players}
                  </span>
                  <span className="font-display font-extrabold text-lime-400">{h.score} pts</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
