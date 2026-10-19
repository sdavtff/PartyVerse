import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { encodeAvatar, randomAvatarParts, Avatar } from '../components/Avatar';
import { AvatarEditor } from '../components/AvatarEditor';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { usePageTitle } from '../lib/usePageTitle';

type Mode = 'login' | 'register' | 'guest';
interface Health {
  dbHint?: string | null;
  accounts: boolean;
  google: boolean;
  db: 'off' | 'connecting' | 'ok' | 'error';
}

const NICK_RE = /^[\p{L}\p{N} _.-]+$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Força da senha de 0 a 4 (só uma ajuda visual). */
function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  else if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s += 0.5;
  return Math.min(4, Math.floor(s));
}
const STRENGTH = [
  { label: 'muito fraca', color: 'bg-pop-rose' },
  { label: 'fraca', color: 'bg-pop-rose' },
  { label: 'ok', color: 'bg-pop-amber' },
  { label: 'boa', color: 'bg-lime-400' },
  { label: 'ótima', color: 'bg-lime-400' },
];

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export function AuthPage() {
  const { login, register, guest, user } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const back = params.get('voltar')?.startsWith('/') ? params.get('voltar')! : '/';
  const [mode, setMode] = useState<Mode>(params.get('modo') === 'cadastro' ? 'register' : 'login');
  const [f, setF] = useState({ email: '', password: '', nickname: '' });
  const [avatar, setAvatar] = useState(() => encodeAvatar(randomAvatarParts()));
  const [editAvatar, setEditAvatar] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState(params.get('erro') ?? '');
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(0);
  const [health, setHealth] = useState<Health | null>(null);
  usePageTitle(
    mode === 'register' ? 'Criar conta' : mode === 'login' ? 'Entrar' : 'Jogar como convidado',
  );

  useEffect(() => {
    api<Health>('/health', { timeoutMs: 8000 })
      .then(setHealth)
      .catch(() => setHealth({ accounts: false, google: false, db: 'error' }));
  }, []);

  // contas fora do ar: já sugere o modo convidado
  useEffect(() => {
    if (health && !health.accounts && mode !== 'guest') setMode('guest');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health]);

  // mensagens de progresso enquanto espera o servidor
  useEffect(() => {
    if (!busy) return setWaited(0);
    const t = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const nickErr =
    f.nickname.trim().length < 2
      ? 'Mínimo de 2 caracteres'
      : f.nickname.trim().length > 20
        ? 'Máximo de 20 caracteres'
        : !NICK_RE.test(f.nickname.trim())
          ? 'Use só letras, números, espaço, _ . -'
          : '';
  const emailErr = EMAIL_RE.test(f.email.trim()) ? '' : 'Digite um e-mail válido';
  const passErr =
    mode === 'register' && f.password.length < 8
      ? 'Mínimo de 8 caracteres'
      : mode === 'login' && !f.password
        ? 'Digite sua senha'
        : '';
  const invalid = (mode !== 'login' && nickErr) || (mode !== 'guest' && (emailErr || passErr));
  const s = strength(f.password);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ nickname: true, email: true, password: true });
    if (invalid) return;
    setBusy(true);
    setErr('');
    try {
      const u =
        mode === 'login'
          ? await login(f.email.trim(), f.password)
          : mode === 'register'
            ? await register(f.email.trim(), f.password, f.nickname.trim(), avatar)
            : await guest(f.nickname.trim(), avatar);
      toast(
        mode === 'register' ? `Conta criada! Bem-vindo, ${u.nickname} 🎉` : `Olá, ${u.nickname}!`,
        'success',
      );
      nav(back);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { id: 'login', label: 'Entrar' },
    { id: 'register', label: 'Criar conta' },
    { id: 'guest', label: 'Convidado' },
  ] as const;
  const accountsDown = health !== null && !health.accounts;
  const googleHref = `/api/auth/google?voltar=${encodeURIComponent(back)}&avatar=${avatar}`;

  const busyText =
    waited < 3
      ? mode === 'register'
        ? 'Criando sua conta…'
        : mode === 'login'
          ? 'Entrando…'
          : 'Preparando…'
      : waited < 8
        ? 'Conectando ao servidor…'
        : 'Está demorando mais que o normal…';

  if (user && !user.isGuest)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="card animate-pop p-8">
          <Avatar avatar={user.avatar} size={80} />
          <h1 className="mt-4 text-2xl font-extrabold">Você já entrou como {user.nickname}</h1>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/" className="rounded-2xl bg-lime-400 px-5 py-3 font-bold text-ink-950">
              Jogar agora
            </Link>
            <Link to="/perfil" className="rounded-2xl bg-ink-700 px-5 py-3 font-bold text-white">
              Meu perfil
            </Link>
          </div>
        </div>
      </div>
    );

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1fr_1.1fr] md:items-start">
      {/* lado de apresentação */}
      <aside className="hidden animate-rise md:block">
        <h2 className="text-4xl font-extrabold leading-tight">
          Sua conta guarda <span className="text-lime-400">tudo que você conquista</span>.
        </h2>
        <ul className="mt-6 space-y-3">
          {[
            ['🏆', 'Entre no ranking', 'Suas vitórias aparecem no ranking geral e de cada jogo.'],
            ['📈', 'Estatísticas e histórico', 'Partidas, vitórias, recorde e as últimas jogadas.'],
            [
              '🎨',
              'Avatar e preferências',
              'Seu personagem, som e animações em qualquer aparelho.',
            ],
            ['⚡', 'Entrar com Google', 'Um clique, sem decorar senha.'],
          ].map(([icon, t, d], i) => (
            <li
              key={t}
              className="card flex animate-rise gap-3 p-4"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-2xl" aria-hidden>
                {icon}
              </span>
              <span>
                <span className="block font-bold text-white">{t}</span>
                <span className="text-sm text-ink-400">{d}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink-400">
          Prefere não criar conta? Dá para jogar como convidado — só não entra no ranking.
        </p>
      </aside>

      <form onSubmit={submit} className="card animate-pop p-6 sm:p-8" noValidate>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-ink-950 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => {
                setMode(t.id);
                setErr('');
                setTouched({});
              }}
              className={`rounded-xl py-2 text-sm font-bold transition ${mode === t.id ? 'bg-lime-400 text-ink-950' : 'text-ink-200 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {accountsDown && (
          <div
            role="status"
            className="mt-5 rounded-2xl border-2 border-pop-amber bg-pop-amber/10 p-3 text-sm text-ink-200"
          >
            <p className="font-bold text-pop-amber">Contas temporariamente indisponíveis</p>
            <p className="mt-1">
              {health?.db === 'off'
                ? 'O banco de dados ainda não foi configurado neste servidor.'
                : 'O servidor está sem conexão com o banco de dados agora.'}{' '}
              Você pode jogar normalmente como convidado.
            </p>
            {health?.dbHint && (
              <p className="mt-2 rounded-xl bg-ink-950/60 p-2 text-xs text-ink-200">
                <strong className="text-white">Para o dono do site:</strong> {health.dbHint}
              </p>
            )}
          </div>
        )}

        <h1 className="mt-6 text-2xl font-extrabold">
          {mode === 'login'
            ? 'Bem-vindo de volta!'
            : mode === 'register'
              ? 'Crie sua conta grátis'
              : 'Só um apelido e pronto'}
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          {mode === 'login'
            ? 'Entre para continuar de onde parou.'
            : mode === 'register'
              ? 'Leva 20 segundos. Suas vitórias passam a contar no ranking.'
              : 'Jogue agora mesmo, sem cadastro.'}
        </p>

        {mode !== 'guest' && health?.google && (
          <>
            <a
              href={googleHref}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 font-bold text-ink-950 shadow-chunky transition hover:bg-ink-200 active:translate-y-0.5 active:shadow-none"
            >
              <GoogleLogo />
              {mode === 'login' ? 'Entrar com Google' : 'Criar conta com Google'}
            </a>
            <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase text-ink-400">
              <span className="h-px flex-1 bg-ink-600" /> ou com e-mail{' '}
              <span className="h-px flex-1 bg-ink-600" />
            </div>
          </>
        )}

        <fieldset
          disabled={busy || (accountsDown && mode !== 'guest')}
          className="mt-5 space-y-4 disabled:opacity-60"
        >
          {mode !== 'login' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditAvatar((v) => !v)}
                className="relative shrink-0 rounded-full"
                aria-label="Editar avatar"
              >
                <Avatar avatar={avatar} size={56} />
                <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-ink-950 bg-lime-400 text-xs text-ink-950">
                  ✎
                </span>
              </button>
              <label className="block flex-1">
                <span className="label">Apelido</span>
                <input
                  className={`input ${touched.nickname && nickErr ? 'border-pop-rose' : ''}`}
                  maxLength={20}
                  value={f.nickname}
                  onChange={(e) => setF({ ...f, nickname: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, nickname: true }))}
                  autoComplete="nickname"
                  placeholder="ex.: Tatu Veloz"
                  aria-invalid={Boolean(touched.nickname && nickErr)}
                />
              </label>
            </div>
          )}
          {mode !== 'login' && touched.nickname && nickErr && (
            <p className="-mt-2 text-xs text-pop-rose">{nickErr}</p>
          )}
          {mode !== 'login' && editAvatar && (
            <div className="rounded-2xl bg-ink-900/60 p-3">
              <AvatarEditor value={avatar} onChange={setAvatar} compact />
            </div>
          )}

          {mode !== 'guest' && (
            <>
              <label className="block">
                <span className="label">E-mail</span>
                <input
                  className={`input ${touched.email && emailErr ? 'border-pop-rose' : ''}`}
                  type="email"
                  inputMode="email"
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  autoComplete="email"
                  placeholder="voce@email.com"
                  aria-invalid={Boolean(touched.email && emailErr)}
                />
                {touched.email && emailErr && (
                  <span className="mt-1 block text-xs text-pop-rose">{emailErr}</span>
                )}
              </label>
              <label className="block">
                <span className="label">Senha</span>
                <span className="relative block">
                  <input
                    className={`input pr-20 ${touched.password && passErr ? 'border-pop-rose' : ''}`}
                    type={showPass ? 'text' : 'password'}
                    value={f.password}
                    onChange={(e) => setF({ ...f, password: e.target.value })}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    aria-invalid={Boolean(touched.password && passErr)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2 text-xs font-bold text-ink-200 hover:bg-ink-700"
                    aria-pressed={showPass}
                  >
                    {showPass ? 'Ocultar' : 'Mostrar'}
                  </button>
                </span>
                {mode === 'register' && (
                  <span className="mt-2 block">
                    <span className="flex gap-1" aria-hidden>
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition ${f.password && i < Math.max(1, s) ? STRENGTH[s]!.color : 'bg-ink-700'}`}
                        />
                      ))}
                    </span>
                    <span className="mt-1 block text-xs text-ink-400">
                      {f.password
                        ? `Senha ${STRENGTH[s]!.label}${f.password.length < 8 ? ' — mínimo de 8 caracteres' : ''}`
                        : 'Mínimo de 8 caracteres. Misture letras, números e símbolos.'}
                    </span>
                  </span>
                )}
                {mode === 'login' && touched.password && passErr && (
                  <span className="mt-1 block text-xs text-pop-rose">{passErr}</span>
                )}
              </label>
            </>
          )}
        </fieldset>

        {err && (
          <p
            role="alert"
            className="mt-4 animate-pop rounded-xl bg-pop-rose/15 px-3 py-2 text-sm text-pop-rose"
          >
            {err}
          </p>
        )}

        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={busy || (accountsDown && mode !== 'guest')}
        >
          {busy ? (
            <>
              <span
                className="h-5 w-5 animate-spin rounded-full border-[3px] border-ink-950/30 border-t-ink-950"
                aria-hidden
              />
              {busyText}
            </>
          ) : mode === 'login' ? (
            'Entrar'
          ) : mode === 'register' ? (
            'Criar conta'
          ) : (
            'Jogar como convidado'
          )}
        </Button>

        <p className="mt-4 text-center text-sm text-ink-400">
          {mode === 'login' ? (
            <>
              Não tem conta?{' '}
              <button
                type="button"
                className="font-bold text-lime-400 hover:underline"
                onClick={() => setMode('register')}
              >
                Criar agora
              </button>
              {health?.google && (
                <span className="mt-2 block text-xs">
                  Esqueceu a senha? Entre com o Google usando o mesmo e-mail.
                </span>
              )}
            </>
          ) : mode === 'register' ? (
            <>
              Já tem conta?{' '}
              <button
                type="button"
                className="font-bold text-lime-400 hover:underline"
                onClick={() => setMode('login')}
              >
                Entrar
              </button>
            </>
          ) : (
            'Convidados jogam tudo, mas não entram no ranking.'
          )}
        </p>
      </form>
    </div>
  );
}
