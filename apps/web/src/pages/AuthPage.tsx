import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { useSession } from '../lib/session';

export function AuthPage() {
  const { login, register, guest } = useSession();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'guest'>('login');
  const [f, setF] = useState({ email: '', password: '', nickname: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (mode === 'login') await login(f.email, f.password);
      else if (mode === 'register') await register(f.email, f.password, f.nickname);
      else await guest(f.nickname);
      nav('/');
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

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <form onSubmit={submit} className="card animate-pop p-6 sm:p-8">
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
              }}
              className={`rounded-xl py-2 text-sm font-bold transition ${mode === t.id ? 'bg-lime-400 text-ink-950' : 'text-ink-200 hover:text-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <h1 className="mt-6 text-2xl font-extrabold">
          {mode === 'login'
            ? 'Bem-vindo de volta'
            : mode === 'register'
              ? 'Sua conta guarda estatísticas e histórico'
              : 'Só um apelido e pronto'}
        </h1>
        <div className="mt-5 space-y-4">
          {mode !== 'login' && (
            <label className="block">
              <span className="label">Apelido</span>
              <input
                className="input"
                required
                minLength={2}
                maxLength={20}
                value={f.nickname}
                onChange={(e) => setF({ ...f, nickname: e.target.value })}
                autoComplete="nickname"
              />
            </label>
          )}
          {mode !== 'guest' && (
            <>
              <label className="block">
                <span className="label">E-mail</span>
                <input
                  className="input"
                  type="email"
                  required
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="label">Senha</span>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                {mode === 'register' && (
                  <span className="mt-1 block text-xs text-ink-400">Mínimo de 8 caracteres.</span>
                )}
              </label>
            </>
          )}
        </div>
        {err && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-pop-rose/15 px-3 py-2 text-sm text-pop-rose"
          >
            {err}
          </p>
        )}
        <Button className="mt-6 w-full" size="lg" disabled={busy}>
          {busy
            ? 'Aguarde…'
            : mode === 'login'
              ? 'Entrar'
              : mode === 'register'
                ? 'Criar conta'
                : 'Jogar como convidado'}
        </Button>
      </form>
    </div>
  );
}
