import { EVENTS, type PublicRoom, type StopView } from '@partyverse/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { actionId, emitAck } from '../../lib/socket';
import { useCountdown } from '../../lib/useCountdown';
import { useSoundOnChange, useTickSound } from '../../lib/useGameSounds';

const STATUS_STYLE = {
  unique: 'bg-lime-400 text-ink-950',
  repeated: 'bg-pop-sky text-ink-950',
  empty: 'bg-ink-700 text-ink-400',
  invalid: 'bg-ink-700 text-ink-400 line-through',
  rejected: 'bg-pop-rose text-ink-950 line-through',
} as const;

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

export function StopGame({ view, room, myId }: { view: StopView; room: PublicRoom; myId: string }) {
  const toast = useToast();
  const left = useCountdown(view.deadline);
  const isPlayer = view.participants.includes(myId);
  const send = (action: unknown) => emitAck(EVENTS.GAME_ACTION, { action, actionId: actionId() });
  const nick = (id: string) => room.players.find((p) => p.id === id)?.nickname ?? 'Alguém';
  const avatar = (id: string) => room.players.find((p) => p.id === id)?.avatar ?? 'blob-1';

  useTickSound(left, view.phase === 'answering' || view.phase === 'stopping');
  useSoundOnChange(
    `${view.round}-${view.phase}`,
    () =>
      (
        ({
          answering: 'go',
          stopping: 'stop',
          review: 'reveal',
          'round-results': 'correct',
          finished: null,
        }) as const
      )[view.phase],
  );

  // ---- respostas locais com envio automático (o servidor guarda a versão oficial)
  const [answers, setAnswers] = useState<Record<string, string>>(view.myAnswers);
  const roundKey = `${view.round}-${view.letter}`;
  const lastRound = useRef(roundKey);
  useEffect(() => {
    if (lastRound.current !== roundKey) {
      lastRound.current = roundKey;
      setAnswers(view.myAnswers);
    }
  }, [roundKey, view.myAnswers]);
  const pending = useRef<ReturnType<typeof setTimeout>>();
  const editable = isPlayer && (view.phase === 'answering' || view.phase === 'stopping');
  const update = (cat: string, v: string) => {
    const next = { ...answers, [cat]: v };
    setAnswers(next);
    clearTimeout(pending.current);
    pending.current = setTimeout(
      () => send({ type: 'answers', answers: next }).catch(() => undefined),
      350,
    );
  };
  // envia o rascunho imediatamente quando a fase muda para "stopping"
  useEffect(() => {
    if (view.phase === 'stopping' && isPlayer)
      send({ type: 'answers', answers }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.phase]);

  const letterOk = (v: string) => norm(v).startsWith(norm(view.letter));
  const complete = view.categories.every((c) => letterOk(answers[c] ?? ''));

  const stop = async () => {
    clearTimeout(pending.current);
    try {
      await send({ type: 'answers', answers });
      await send({ type: 'stop' });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const header = (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className="grid h-20 w-20 animate-pop place-items-center rounded-3xl border-4 border-ink-950 bg-lime-400 font-display text-5xl font-extrabold text-ink-950 shadow-chunky"
        aria-label={`Letra ${view.letter}`}
      >
        {view.letter}
      </div>
      <div className="flex-1">
        <p className="text-sm text-ink-400">
          Rodada {view.round} de {view.totalRounds}
        </p>
        <p className="font-display text-2xl font-extrabold text-white">
          {
            {
              answering: 'Preencha tudo com a letra!',
              stopping: `${nick(view.stoppedBy ?? '')} gritou STOP!`,
              review: 'Hora de conferir',
              'round-results': 'Resultado da rodada',
              finished: 'Fim de jogo',
            }[view.phase]
          }
        </p>
      </div>
      {view.deadline && (
        <div
          className={`rounded-2xl px-4 py-2 font-display text-3xl font-extrabold tabular-nums ${left <= 5 ? 'animate-pulse bg-pop-rose text-ink-950' : 'bg-ink-700 text-white'}`}
          role="timer"
          aria-label={`${left} segundos restantes`}
        >
          {left}s
        </div>
      )}
    </div>
  );

  // ---------------- respostas ----------------
  if (view.phase === 'answering' || view.phase === 'stopping') {
    return (
      <div className="card space-y-5 p-5">
        {header}
        {!isPlayer && (
          <p className="rounded-2xl bg-ink-900 p-3 text-sm text-ink-400">
            Você entrou com a partida em andamento e está assistindo. Você joga na próxima!
          </p>
        )}
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (complete && view.phase === 'answering') stop();
          }}
        >
          {view.categories.map((c, i) => {
            const v = answers[c] ?? '';
            const bad = v.trim() !== '' && !letterOk(v);
            return (
              <label
                key={c}
                className="block animate-rise"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="label">{c}</span>
                <input
                  className={`input ${bad ? 'border-pop-rose' : v ? 'border-lime-500' : ''}`}
                  value={v}
                  maxLength={40}
                  disabled={!editable}
                  autoComplete="off"
                  onChange={(e) => update(c, e.target.value)}
                  placeholder={`${view.letter}…`}
                  aria-invalid={bad}
                />
                {bad && (
                  <span className="mt-1 block text-xs text-pop-rose">
                    Precisa começar com {view.letter}
                  </span>
                )}
              </label>
            );
          })}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
        {isPlayer && view.phase === 'answering' && (
          <Button
            size="lg"
            className="w-full font-display text-2xl tracking-widest"
            variant="danger"
            disabled={!complete}
            onClick={stop}
          >
            STOP!
          </Button>
        )}
        {view.phase === 'stopping' && (
          <p className="text-center font-bold text-pop-amber">Últimos segundos para terminar!</p>
        )}
      </div>
    );
  }

  // ---------------- revisão e resultados ----------------
  return (
    <StopReview
      view={view}
      myId={myId}
      header={header}
      nick={nick}
      avatar={avatar}
      send={send}
      isPlayer={isPlayer}
    />
  );
}

function StopReview({
  view,
  myId,
  header,
  nick,
  avatar,
  send,
  isPlayer,
}: {
  view: StopView;
  myId: string;
  header: JSX.Element;
  nick: (id: string) => string;
  avatar: (id: string) => string;
  send: (a: unknown) => Promise<unknown>;
  isPlayer: boolean;
}) {
  const toast = useToast();
  const ready = view.readyPlayers.includes(myId);
  const results = view.phase === 'round-results' || view.phase === 'finished';
  const vote = (targetId: string, category: string, valid: boolean) =>
    send({ type: 'vote', targetId, category, valid }).catch((e) => toast(e.message, 'error'));
  const ranking = useMemo(
    () =>
      view.participants.map((p) => ({
        p,
        round: Object.values(view.roundScores?.[p] ?? {}).reduce((a, b) => a + b, 0),
      })),
    [view],
  );

  return (
    <div className="card space-y-5 p-5">
      {header}
      {view.phase === 'review' ? (
        <CategoryReview
          view={view}
          myId={myId}
          nick={nick}
          avatar={avatar}
          isPlayer={isPlayer}
          vote={vote}
          ready={ready}
          onDone={() => send({ type: 'ready' }).catch((e) => toast(e.message, 'error'))}
        />
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[30rem] border-separate border-spacing-y-1.5 text-sm">
            <thead>
              <tr className="text-left text-ink-400">
                <th scope="col" className="sticky left-0 z-10 bg-ink-800 px-2 font-bold">
                  Categoria
                </th>
                {view.review.map((r) => (
                  <th scope="col" key={r.playerId} className="px-2">
                    <span className="flex items-center gap-1.5 font-bold text-white">
                      <Avatar avatar={avatar(r.playerId)} size={22} />
                      {nick(r.playerId)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.categories.map((c) => (
                <tr key={c}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-ink-800 px-2 text-left font-bold text-ink-200"
                  >
                    {c}
                  </th>
                  {view.review.map((r) => {
                    const ans = r.answers[c] ?? '';
                    const status = r.statuses?.[c];
                    const mine = r.playerId === myId;
                    const rejectedByMe = r.myRejections.includes(c);
                    const pts = view.roundScores?.[r.playerId]?.[c];
                    const canVote =
                      view.phase === 'review' && isPlayer && !mine && ans.trim() !== '';
                    return (
                      <td key={r.playerId} className="px-1">
                        <button
                          type="button"
                          disabled={!canVote}
                          onClick={() => vote(r.playerId, c, rejectedByMe)}
                          aria-pressed={canVote ? rejectedByMe : undefined}
                          title={
                            canVote
                              ? rejectedByMe
                                ? 'Desfazer contestação'
                                : 'Contestar esta resposta'
                              : undefined
                          }
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left font-medium transition ${status ? STATUS_STYLE[status] : rejectedByMe ? 'bg-pop-rose/30 text-white ring-2 ring-pop-rose' : 'bg-ink-900 text-white'} ${canVote ? 'hover:ring-2 hover:ring-ink-400' : 'cursor-default'}`}
                        >
                          <span className="truncate">{ans || '—'}</span>
                          {results && pts !== undefined ? (
                            <span className="font-display font-extrabold">+{pts}</span>
                          ) : r.rejections[c]! > 0 ? (
                            <span className="chip bg-pop-rose text-ink-950">
                              ✕{r.rejections[c]}
                            </span>
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {results && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries({
            unique: 'Única',
            repeated: 'Repetida',
            rejected: 'Contestada',
            invalid: 'Fora da letra / vazia',
          }).map(([k, v]) => (
            <span key={k} className={`chip ${STATUS_STYLE[k as keyof typeof STATUS_STYLE]}`}>
              {v}
            </span>
          ))}
        </div>
      )}
      {results && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...ranking]
            .sort((a, b) => (view.totals[b.p] ?? 0) - (view.totals[a.p] ?? 0))
            .map(({ p, round }) => (
              <li key={p} className="flex items-center gap-3 rounded-2xl bg-ink-900 px-3 py-2">
                <Avatar avatar={avatar(p)} size={28} />
                <span className="flex-1 font-bold text-white">{nick(p)}</span>
                <span className="text-sm text-lime-400">+{round}</span>
                <span className="font-display text-xl font-extrabold text-white">
                  {view.totals[p] ?? 0}
                </span>
              </li>
            ))}
        </ul>
      )}
      {isPlayer && view.phase === 'round-results' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-400">
            {view.readyPlayers.length}/{view.participants.length} prontos
          </p>
          <Button
            disabled={ready}
            onClick={() => send({ type: 'ready' }).catch((e) => toast(e.message, 'error'))}
          >
            {ready ? 'Aguardando os outros…' : 'Próxima rodada'}
          </Button>
        </div>
      )}
    </div>
  );
}

const normKey = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Revisão uma categoria por vez: respostas iguais aparecem juntas; toque em "Denunciar". */
function CategoryReview({
  view,
  myId,
  nick,
  avatar,
  isPlayer,
  vote,
  ready,
  onDone,
}: {
  view: StopView;
  myId: string;
  nick: (id: string) => string;
  avatar: (id: string) => string;
  isPlayer: boolean;
  vote: (targetId: string, category: string, valid: boolean) => unknown;
  ready: boolean;
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const cat = view.categories[Math.min(idx, view.categories.length - 1)]!;
  const last = idx >= view.categories.length - 1;

  // agrupa respostas iguais (ignorando acento/caixa)
  const groups = new Map<string, { text: string; authors: string[] }>();
  const empty: string[] = [];
  for (const r of view.review) {
    const ans = (r.answers[cat] ?? '').trim();
    if (!ans) {
      empty.push(r.playerId);
      continue;
    }
    const k = normKey(ans);
    const g = groups.get(k) ?? { text: ans, authors: [] };
    g.authors.push(r.playerId);
    groups.set(k, g);
  }
  const startsOk = (t: string) => normKey(t).startsWith(normKey(view.letter));

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display text-2xl font-extrabold uppercase text-pop-amber">{cat}</p>
        <p className="text-sm font-bold text-ink-400">
          Valide as respostas · {idx + 1}/{view.categories.length}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {[...groups.values()].map((g) => {
          const others = g.authors.filter((a) => a !== myId);
          const mineOnly = others.length === 0;
          const deniedByMe =
            others.length > 0 &&
            others.every((a) =>
              view.review.find((r) => r.playerId === a)?.myRejections.includes(cat),
            );
          const count = Math.max(
            ...g.authors.map(
              (a) => view.review.find((r) => r.playerId === a)?.rejections[cat] ?? 0,
            ),
          );
          const bad = !startsOk(g.text);
          return (
            <li key={g.text}>
              <div
                className={`rounded-2xl border-4 border-ink-950 px-4 py-2.5 text-center font-display text-lg font-extrabold uppercase shadow-chunky transition ${bad ? 'bg-ink-700 text-ink-400 line-through' : deniedByMe ? 'bg-pop-rose text-ink-950' : 'bg-[#7be0c3] text-ink-950'}`}
              >
                {g.text}
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
                <span className="flex -space-x-1.5" title={g.authors.map(nick).join(', ')}>
                  {g.authors.slice(0, 5).map((a) => (
                    <Avatar key={a} avatar={avatar(a)} size={22} label={nick(a)} />
                  ))}
                  {g.authors.length > 1 && (
                    <span className="ml-2 text-xs text-ink-400">×{g.authors.length}</span>
                  )}
                </span>
                {bad ? (
                  <span className="text-xs font-bold text-ink-400">fora da letra</span>
                ) : mineOnly ? (
                  <span className="text-xs font-bold text-ink-400">sua resposta</span>
                ) : isPlayer ? (
                  <button
                    type="button"
                    onClick={() => others.forEach((a) => vote(a, cat, deniedByMe))}
                    aria-pressed={deniedByMe}
                    className={`rounded-lg px-2 py-0.5 text-xs font-extrabold uppercase ${deniedByMe ? 'bg-pop-rose text-ink-950' : 'text-ink-200 hover:bg-ink-700'}`}
                  >
                    {deniedByMe ? 'Denunciada ✕' : '⚠ Denunciar'}
                  </button>
                ) : null}
                {count > 0 && !bad && (
                  <span className="chip bg-pop-rose text-ink-950">✕{count}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {empty.length > 0 && (
        <p className="text-center text-xs text-ink-400">Em branco: {empty.map(nick).join(', ')}</p>
      )}
      {groups.size === 0 && (
        <p className="text-center text-ink-400">Ninguém respondeu esta categoria.</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
          ‹ Anterior
        </Button>
        <span className="text-xs text-ink-400">
          {view.readyPlayers.length}/{view.participants.length} terminaram
        </span>
        {!last ? (
          <Button onClick={() => setIdx((i) => i + 1)}>Validar ›</Button>
        ) : isPlayer ? (
          <Button disabled={ready} onClick={onDone}>
            {ready ? 'Aguardando os outros…' : 'Validar e terminar'}
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
