import { EVENTS, STICKERS, type ChatMessage } from '@partyverse/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { emitAck } from '../lib/socket';
import { sfx } from '../lib/sound';
import { Sticker } from './Sticker';
import { useToast } from './Toast';

export function ChatPanel({
  messages,
  myId,
  disabled,
  placeholder = 'Diga oi…',
  title = 'Chat',
}: {
  messages: ChatMessage[];
  myId: string;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
}) {
  const [text, setText] = useState('');
  const [stickers, setStickers] = useState(false);
  const toast = useToast();
  const listRef = useRef<HTMLOListElement>(null);

  const lastId = useRef<string | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    const last = messages.at(-1);
    // sons para mensagens novas (não no histórico inicial)
    if (last && lastId.current && last.id !== lastId.current) {
      if (last.kind === 'guess-correct') sfx('correct');
      else if ((last.kind === 'chat' || last.kind === 'sticker') && last.playerId !== myId)
        sfx('message');
    }
    lastId.current = last?.id ?? null;
  }, [messages, myId]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      await emitAck(EVENTS.CHAT_SEND, { text: t });
    } catch (err) {
      setText(t);
      toast((err as Error).message, 'error');
    }
  };

  const sendSticker = async (sticker: string) => {
    try {
      await emitAck(EVENTS.CHAT_SEND, { sticker });
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  return (
    <section className="card flex h-full min-h-[18rem] flex-col p-0" aria-label="Chat da sala">
      <h2 className="border-b-2 border-ink-700 px-4 py-3 text-lg font-extrabold">{title}</h2>
      <ol
        ref={listRef}
        className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm"
        aria-live="polite"
      >
        {messages.map((m) => (
          <Message key={m.id} m={m} myId={myId} />
        ))}
      </ol>
      {stickers && (
        <div
          className="grid grid-cols-6 gap-1 border-t-2 border-ink-700 p-2"
          aria-label="Figurinhas"
        >
          {STICKERS.map((id) => (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => void sendSticker(id)}
              className="grid place-items-center rounded-xl p-1 transition hover:-translate-y-0.5 hover:bg-ink-700 disabled:opacity-50"
              title={id}
            >
              <Sticker id={id} size={38} />
            </button>
          ))}
        </div>
      )}
      <form onSubmit={send} className="flex gap-2 border-t-2 border-ink-700 p-3">
        <button
          type="button"
          onClick={() => setStickers((v) => !v)}
          aria-pressed={stickers}
          aria-label="Figurinhas"
          title="Figurinhas"
          className={`grid w-11 shrink-0 place-items-center rounded-2xl transition ${stickers ? 'bg-lime-400' : 'bg-ink-700 hover:bg-ink-600'}`}
        >
          <Sticker id="risada" size={26} />
        </button>
        <label htmlFor="chat-input" className="sr-only">
          Mensagem
        </label>
        <input
          id="chat-input"
          className="input py-2"
          maxLength={300}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          className="rounded-2xl bg-ink-700 px-4 font-bold text-white hover:bg-ink-600 disabled:opacity-50"
          disabled={disabled || !text.trim()}
        >
          Enviar
        </button>
      </form>
    </section>
  );
}

function Message({ m, myId }: { m: ChatMessage; myId: string }) {
  const nickColor = m.playerId === myId ? 'text-lime-400' : 'text-pop-sky';
  switch (m.kind) {
    case 'system':
      return <li className="text-center text-xs italic text-ink-400">{m.text}</li>;
    case 'guess-correct':
      return (
        <li className="animate-pop rounded-xl bg-lime-400/15 px-2 py-1 text-center font-bold text-lime-400">
          ✓ {m.text}
        </li>
      );
    case 'guess-close':
      return (
        <li className="animate-pop rounded-xl bg-pop-amber/15 px-2 py-1 text-center font-bold text-pop-amber">
          {m.text}
        </li>
      );
    case 'whisper':
      return (
        <li className="rounded-xl bg-pop-violet/15 px-2 py-1 text-center text-xs font-bold text-pop-violet">
          {m.text}
        </li>
      );
    case 'sticker':
      return (
        <li className="flex animate-pop items-end gap-2">
          <span className={`font-bold ${nickColor}`}>{m.nickname}:</span>
          <Sticker id={m.sticker ?? ''} size={52} />
        </li>
      );
    default:
      return (
        <li className="animate-rise break-words">
          <span className={`font-bold ${nickColor}`}>{m.nickname}: </span>
          <span className="text-ink-200">{m.text}</span>
        </li>
      );
  }
}
