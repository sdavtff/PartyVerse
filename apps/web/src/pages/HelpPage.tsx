import { Link } from 'react-router-dom';
import { usePageTitle } from '../lib/usePageTitle';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Preciso instalar alguma coisa?',
    a: 'Não. O PartyVerse roda no navegador do celular ou do computador. É só abrir o link.',
  },
  {
    q: 'Como convido meus amigos?',
    a: 'Crie uma sala e toque em "Link" para copiar o convite, ou mande o código de 6 letras. Quem abrir o link entra direto.',
  },
  {
    q: 'Preciso criar conta?',
    a: 'Não. Dá para jogar como convidado escolhendo um apelido e um avatar. Com conta, suas vitórias entram no ranking e no histórico.',
  },
  {
    q: 'Quantas pessoas podem jogar?',
    a: 'Até 50 por sala. Jogos de desenhar e adivinhar ficam melhores com até 12–15 pessoas, porque cada uma tem sua vez.',
  },
  {
    q: 'Como deixo a sala só para amigos?',
    a: 'Deixe a sala como "Privada" (ela não aparece na lista pública) e, se quiser, defina uma senha ao criar ou no lobby.',
  },
  {
    q: 'Minha internet caiu. Perdi a partida?',
    a: 'Não. Você tem 1 minuto para voltar: recarregue a página ou abra o link de novo e você volta para o mesmo lugar.',
  },
  {
    q: 'O anfitrião saiu. E agora?',
    a: 'A liderança passa automaticamente para o jogador conectado há mais tempo.',
  },
  {
    q: 'Como jogo Mímica a distância?',
    a: 'Abram uma chamada de vídeo (WhatsApp, Meet, Discord…) e usem o PartyVerse para sortear as palavras, chutar e contar pontos.',
  },
  {
    q: 'Dá para desligar os sons ou as animações?',
    a: 'Sim: o botão de som fica no topo da página, e "Reduzir animações" está no seu perfil.',
  },
];

export function HelpPage() {
  usePageTitle('Ajuda');
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Ajuda</h1>
      <p className="mt-2 text-lg text-ink-200">
        Tudo o que você precisa para começar a jogar em menos de um minuto.
      </p>

      <section className="card mt-8 p-6" aria-labelledby="start">
        <h2 id="start" className="text-2xl font-extrabold">
          Começando em 3 passos
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            ['Crie a sala', 'Escolha o jogo, o nome e se a sala é pública ou privada.'],
            ['Chame a galera', 'Copie o link de convite e mande no grupo.'],
            ['Começar!', 'Quando todos chegarem, o anfitrião aperta "Começar partida".'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl bg-ink-900 p-4">
              <span className="font-display text-3xl font-extrabold text-lime-400">{i + 1}</span>
              <p className="mt-1 font-bold text-white">{t}</p>
              <p className="text-sm text-ink-400">{d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/#criar"
            className="rounded-2xl bg-lime-400 px-5 py-3 font-bold text-ink-950 shadow-chunky hover:bg-lime-300"
          >
            Criar uma sala
          </Link>
          <Link
            to="/jogos"
            className="rounded-2xl bg-ink-700 px-5 py-3 font-bold text-white hover:bg-ink-600"
          >
            Ver regras dos jogos
          </Link>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="faq">
        <h2 id="faq" className="text-2xl font-extrabold">
          Perguntas frequentes
        </h2>
        <div className="mt-4 space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-bold text-white">
                {f.q}
                <span className="text-lime-400 transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="px-5 pb-4 text-ink-200">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="card mt-8 p-6" aria-labelledby="about">
        <h2 id="about" className="text-2xl font-extrabold">
          Sobre o PartyVerse
        </h2>
        <p className="mt-3 text-ink-200">
          O PartyVerse junta vários jogos de festa num lugar só: Adedonha, Rabisco, Mímica, Quiz,
          Palavra Secreta e Impostor. Tudo em tempo real, de graça e sem instalar nada — feito para
          reunir os amigos, seja no mesmo sofá ou cada um na sua casa.
        </p>
      </section>
    </div>
  );
}
