import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { api, type Identity } from '../lib/api';
import { useSession } from '../lib/session';
import { usePageTitle } from '../lib/usePageTitle';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** /esqueci-senha — pede o e-mail e envia o link. */
export function ForgotPasswordPage() {
  usePageTitle('Esqueci minha senha');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent)
    return (
      <Shell title="Confira seu e-mail 📬">
        <p className="mt-3 text-ink-200">
          Se existe uma conta com <b className="text-white">{email}</b>, enviamos um link para criar
          uma senha nova. Ele vale por 1 hora. Olhe também a caixa de spam.
        </p>
        <Link to="/entrar" className="mt-6 inline-block font-bold text-lime-400 hover:underline">
          Voltar para o login
        </Link>
      </Shell>
    );

  return (
    <Shell title="Esqueci minha senha">
      <p className="mt-2 text-ink-200">
        Digite o e-mail da sua conta e mandamos um link para trocar a senha.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api('/auth/forgot', { method: 'POST', json: { email: email.trim() } });
            setSent(true);
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          <span className="label">E-mail</span>
          <input
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-pop-rose/15 px-3 py-2 text-sm text-pop-rose">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy || !email.includes('@')}>
          {busy ? 'Enviando…' : 'Enviar link'}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-ink-400">
        Lembrou?{' '}
        <Link to="/entrar" className="font-bold text-lime-400 hover:underline">
          Entrar
        </Link>
      </p>
    </Shell>
  );
}

/** /redefinir-senha?token=… — cria a senha nova e já entra. */
export function ResetPasswordPage() {
  usePageTitle('Nova senha');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setUser } = useSession();
  const toast = useToast();
  const nav = useNavigate();

  if (!token)
    return (
      <Shell title="Link incompleto">
        <p className="mt-3 text-ink-200">Abra o link exatamente como chegou no e-mail.</p>
        <Link
          to="/esqueci-senha"
          className="mt-6 inline-block font-bold text-lime-400 hover:underline"
        >
          Pedir um link novo
        </Link>
      </Shell>
    );

  const mismatch = pass2.length > 0 && pass !== pass2;
  return (
    <Shell title="Criar nova senha">
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (pass.length < 8 || mismatch) return;
          setBusy(true);
          setError(null);
          try {
            const r = await api<{ user: Identity }>('/auth/reset', {
              method: 'POST',
              json: { token, password: pass },
            });
            setUser(r.user);
            toast('Senha trocada! Você já está conectado.', 'success');
            nav('/perfil');
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="block">
          <span className="label">Nova senha</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
          <span className="mt-1 block text-xs text-ink-400">Mínimo de 8 caracteres.</span>
        </label>
        <label className="block">
          <span className="label">Repita a senha</span>
          <input
            className={`input ${mismatch ? 'border-pop-rose' : ''}`}
            type="password"
            autoComplete="new-password"
            required
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
          />
          {mismatch && (
            <span className="mt-1 block text-xs text-pop-rose">As senhas não batem.</span>
          )}
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-pop-rose/15 px-3 py-2 text-sm text-pop-rose">
            {error}{' '}
            <Link to="/esqueci-senha" className="font-bold underline">
              Pedir outro link
            </Link>
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={busy || pass.length < 8 || mismatch}
        >
          {busy ? 'Salvando…' : 'Salvar e entrar'}
        </Button>
      </form>
    </Shell>
  );
}
