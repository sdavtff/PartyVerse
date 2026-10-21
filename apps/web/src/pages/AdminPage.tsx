import { GAME_CATALOG, REPORT_REASON_LABELS } from '@partyverse/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { usePageTitle } from '../lib/usePageTitle';

interface Stats {
  rooms: number;
  playersOnline: number;
  accountsOnline: number;
  users: { total: number; recent: number } | null;
  matches: { total: number; recent: number; byGame: Record<string, number> } | null;
  daily: { quiz: number; stop: number; source?: 'ia' | 'banco' | null } | null;
  db: string;
  mail: boolean;
  reportsOpen?: number;
  ai?: boolean;
  uptimeMin: number;
}
interface Report {
  id: string;
  reporterName: string;
  targetId: string;
  targetName: string;
  targetIsGuest: boolean;
  roomCode: string | null;
  reason: keyof typeof REPORT_REASON_LABELS;
  details: string;
  evidence: { text: string; at: number }[];
  status: 'open' | 'closed';
  createdAt: string;
}
interface AdminRoom {
  code: string;
  name: string;
  gameId: string;
  phase: string;
  isPublic: boolean;
  lastActivity: number;
  players: { id: string; nickname: string; status: string; isGuest: boolean }[];
}
interface AdminUser {
  id: string;
  nickname: string;
  email: string;
  avatar: string;
  banned: boolean;
  createdAt: string | null;
  admin: boolean;
}

const gameName = (id: string) => GAME_CATALOG.find((g) => g.id === id)?.name ?? id;
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`;
};

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink-400">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold text-white">{value}</p>
      {sub && <p className="text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

export function AdminPage() {
  usePageTitle('Administração');
  const { user, admin, loading } = useSession();
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const load = useCallback(() => {
    api<Stats>('/admin/stats')
      .then(setStats)
      .catch(() => undefined);
    api<AdminRoom[]>('/admin/rooms')
      .then(setRooms)
      .catch(() => undefined);
    api<Report[]>('/admin/reports')
      .then(setReports)
      .catch(() => undefined);
  }, []);
  const search = useCallback(
    (term: string) =>
      api<AdminUser[]>(`/admin/users?q=${encodeURIComponent(term)}`)
        .then(setUsers)
        .catch(() => undefined),
    [],
  );

  useEffect(() => {
    if (!admin) return;
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [admin, load]);
  useEffect(() => {
    if (!admin) return;
    const t = setTimeout(() => void search(q.trim()), 300);
    return () => clearTimeout(t);
  }, [admin, q, search]);

  if (loading) return null;
  if (!user || !admin)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-3xl font-extrabold">Área restrita</h1>
        <p className="mt-2 text-ink-200">
          Só administradores entram aqui. O dono do site define quem é administrador na variável{' '}
          <code className="rounded bg-ink-800 px-1">ADMIN_EMAILS</code> da hospedagem.
        </p>
      </div>
    );

  const closeRoom = async (r: AdminRoom) => {
    if (!confirm(`Fechar a sala ${r.code} (${r.players.length} pessoas)?`)) return;
    try {
      await api(`/admin/rooms/${r.code}`, { method: 'DELETE' });
      toast('Sala fechada', 'success');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const ban = async (u: AdminUser, banned: boolean) => {
    if (
      banned &&
      !confirm(`Suspender ${u.nickname}? A pessoa sai de todas as salas e não consegue entrar.`)
    )
      return;
    try {
      await api(`/admin/users/${u.id}/ban`, { method: 'POST', json: { banned } });
      toast(banned ? `${u.nickname} suspenso` : `${u.nickname} liberado`, 'success');
      void search(q.trim());
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const closeReport = async (r: Report) => {
    await api(`/admin/reports/${r.id}`, { method: 'POST', json: { status: 'closed' } }).catch((e) =>
      toast((e as Error).message, 'error'),
    );
    load();
  };
  const banFromReport = async (r: Report) => {
    if (!confirm(`Suspender a conta de ${r.targetName}?`)) return;
    try {
      await api(`/admin/users/${r.targetId}/ban`, { method: 'POST', json: { banned: true } });
      await api(`/admin/reports/${r.id}`, { method: 'POST', json: { status: 'closed' } });
      toast(`${r.targetName} suspenso`, 'success');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const topGames = Object.entries(stats?.matches?.byGame ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold">Administração</h1>
          <p className="text-ink-400">Atualiza sozinho a cada 15 segundos.</p>
        </div>
        <button
          onClick={load}
          className="rounded-xl bg-ink-800 px-4 py-2 font-bold hover:bg-ink-700"
        >
          ↻ Atualizar
        </button>
      </div>

      {stats && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Jogando agora"
            value={stats.playersOnline}
            sub={`${stats.rooms} salas abertas`}
          />
          <Stat label="Contas online" value={stats.accountsOnline} />
          <Stat
            label="Contas"
            value={stats.users?.total ?? '—'}
            sub={stats.users ? `+${stats.users.recent} nas últimas 24h` : 'sem banco'}
          />
          <Stat
            label="Partidas"
            value={stats.matches?.total ?? '—'}
            sub={stats.matches ? `${stats.matches.recent} nas últimas 24h` : undefined}
          />
          <Stat
            label="Desafio de hoje"
            value={(stats.daily?.quiz ?? 0) + (stats.daily?.stop ?? 0)}
            sub={`${stats.daily?.quiz ?? 0} quiz · ${stats.daily?.stop ?? 0} adedonha · ${stats.daily?.source === 'ia' ? '🤖 feito por IA' : 'banco reserva'}`}
          />
          <Stat label="Banco" value={stats.db === 'ok' ? '✅' : stats.db} />
          <Stat
            label="IA"
            value={stats.ai ? '✅' : '—'}
            sub={stats.ai ? 'OpenRouter ligada' : 'sem OPENROUTER_API_KEY'}
          />
          <Stat label="Denúncias" value={stats.reportsOpen ?? 0} sub="abertas" />
          <Stat
            label="E-mail"
            value={stats.mail ? '✅' : '—'}
            sub={stats.mail ? 'SMTP ok' : 'SMTP não configurado'}
          />
          <Stat
            label="No ar há"
            value={`${Math.floor(stats.uptimeMin / 60)}h${String(stats.uptimeMin % 60).padStart(2, '0')}`}
          />
        </div>
      )}
      {topGames.length > 0 && (
        <p className="mt-4 text-sm text-ink-200">
          <b className="text-white">Mais jogados (24h):</b>{' '}
          {topGames.map(([g, n]) => `${gameName(g)} (${n})`).join(' · ')}
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold">
          Denúncias{' '}
          {reports.length > 0 && (
            <span className="chip bg-pop-rose align-middle text-night">
              {reports.length} abertas
            </span>
          )}
        </h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-ink-400">Nenhuma denúncia aberta. 🎉</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-white">
                      {r.targetName}{' '}
                      <span className="text-xs font-normal text-ink-400">
                        {r.targetIsGuest ? 'convidado' : 'conta'}
                      </span>
                    </p>
                    <p className="text-sm text-ink-200">
                      <b className="text-pop-rose">{REPORT_REASON_LABELS[r.reason] ?? r.reason}</b>{' '}
                      · por {r.reporterName} · {new Date(r.createdAt).toLocaleString('pt-BR')}
                      {r.roomCode && ` · sala ${r.roomCode}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!r.targetIsGuest && (
                      <button
                        onClick={() => banFromReport(r)}
                        className="rounded-lg px-3 py-1.5 text-sm font-bold text-pop-rose hover:bg-ink-800"
                      >
                        Suspender
                      </button>
                    )}
                    {r.roomCode && rooms.some((x) => x.code === r.roomCode) && (
                      <button
                        onClick={() => void closeRoom(rooms.find((x) => x.code === r.roomCode)!)}
                        className="rounded-lg px-3 py-1.5 text-sm font-bold text-ink-200 hover:bg-ink-800"
                      >
                        Fechar sala
                      </button>
                    )}
                    <button
                      onClick={() => closeReport(r)}
                      className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-bold hover:bg-ink-700"
                    >
                      Resolvida ✓
                    </button>
                  </div>
                </div>
                {r.details && <p className="mt-2 text-sm text-ink-200">“{r.details}”</p>}
                {r.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded-xl bg-ink-900 p-3 text-sm">
                    {r.evidence.map((m, i) => (
                      <li key={i} className="text-ink-200">
                        <span className="text-xs text-ink-400">
                          {new Date(m.at).toLocaleTimeString('pt-BR')}
                        </span>{' '}
                        {m.text}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold">Salas abertas</h2>
        {rooms.length === 0 ? (
          <p className="mt-3 text-ink-400">Nenhuma sala agora.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-ink-400">
                <tr>
                  <th className="p-2">Código</th>
                  <th className="p-2">Sala</th>
                  <th className="p-2">Jogo</th>
                  <th className="p-2">Pessoas</th>
                  <th className="p-2">Atividade</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.code} className="border-t border-ink-700">
                    <td className="p-2 font-display font-extrabold tracking-widest text-lime-400">
                      {r.code}
                    </td>
                    <td className="p-2">
                      <span className="font-bold text-white">{r.name}</span>{' '}
                      <span className="text-xs text-ink-400">
                        {r.isPublic ? 'pública' : 'privada'} ·{' '}
                        {r.phase === 'playing' ? 'jogando' : r.phase}
                      </span>
                    </td>
                    <td className="p-2">{gameName(r.gameId)}</td>
                    <td className="p-2" title={r.players.map((p) => p.nickname).join(', ')}>
                      {r.players.filter((p) => p.status === 'online').length}/{r.players.length}
                    </td>
                    <td className="p-2 text-ink-400">{ago(r.lastActivity)}</td>
                    <td className="p-2 text-right">
                      <button
                        onClick={() => closeRoom(r)}
                        className="rounded-lg px-2 py-1 font-bold text-pop-rose hover:bg-ink-800"
                      >
                        Fechar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-extrabold">Contas</h2>
        <input
          className="input mt-3 max-w-md"
          placeholder="Buscar por apelido ou e-mail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar contas"
        />
        <ul className="mt-3 divide-y divide-ink-700">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
              <Avatar avatar={u.avatar} size={34} dim={u.banned} />
              <span className="min-w-0 flex-1">
                <Link to={`/jogador/${u.id}`} className="block truncate font-bold hover:underline">
                  {u.nickname} {u.admin && <span className="text-xs text-pop-amber">★ admin</span>}
                  {u.banned && <span className="text-xs text-pop-rose"> · suspenso</span>}
                </Link>
                <span className="block truncate text-xs text-ink-400">
                  {u.email}
                  {u.createdAt && ` · desde ${new Date(u.createdAt).toLocaleDateString('pt-BR')}`}
                </span>
              </span>
              {!u.admin &&
                (u.banned ? (
                  <button
                    onClick={() => ban(u, false)}
                    className="rounded-lg bg-ink-800 px-3 py-1.5 text-sm font-bold hover:bg-ink-700"
                  >
                    Liberar
                  </button>
                ) : (
                  <button
                    onClick={() => ban(u, true)}
                    className="rounded-lg px-3 py-1.5 text-sm font-bold text-pop-rose hover:bg-ink-800"
                  >
                    Suspender
                  </button>
                ))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
