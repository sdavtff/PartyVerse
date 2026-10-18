import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../lib/session';
import { Button } from './Button';

/** Garante que existe uma sessão (convidado ou conta) antes de mostrar o conteúdo. */
export function NicknameGate({
  children,
  title = 'Como vão te chamar?',
}: {
  children: ReactNode;
  title?: string;
}) {
  const { user, loading, guest } = useSession();
  const [nick, setNick] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="p-10 text-center text-ink-400">Carregando…</div>;
  if (user) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await guest(nick);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <form onSubmit={submit} className="card animate-pop p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-1 text-ink-400">
          Entre como convidado em segundos. Dá pra criar conta depois.
        </p>
        <label htmlFor="nick" className="label mt-6">
          Apelido
        </label>
        <input
          id="nick"
          className="input"
          autoFocus
          maxLength={20}
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="ex.: Capivara Veloz"
        />
        {err && (
          <p role="alert" className="mt-2 text-sm text-pop-rose">
            {err}
          </p>
        )}
        <Button className="mt-5 w-full" size="lg" disabled={busy || nick.trim().length < 2}>
          {busy ? 'Entrando…' : 'Jogar como convidado'}
        </Button>
        <p className="mt-4 text-center text-sm text-ink-400">
          Tem conta?{' '}
          <Link to="/entrar" className="font-bold text-lime-400 hover:underline">
            Fazer login
          </Link>
        </p>
      </form>
    </div>
  );
}
