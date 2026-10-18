import { EVENTS, type ChatMessage } from '@partyverse/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { emitAck } from '../lib/socket';
import { useToast } from './Toast';

export function ChatPanel({
  messages,
  myId,
  disabled,
}: {
  messages: ChatMessage[];
  myId: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const toast = useToast();
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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

  return (
    <section className="card flex h-full min-h-[18rem] flex-col p-0" aria-label="Chat da sala">
      <h2 className="border-b-2 border-ink-700 px-4 py-3 text-lg font-extrabold">Chat</h2>
      <ol
        ref={listRef}
        className="flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm"
        aria-live="polite"
      >
        {messages.map((m) =>
          m.kind === 'system' ? (
            <li key={m.id} className="text-center text-xs italic text-ink-400">
              {m.text}
            </li>
          ) : (
            <li key={m.id} className="animate-rise break-words">
              <span
                className={`font-bold ${m.playerId === myId ? 'text-lime-400' : 'text-pop-sky'}`}
              >
                {m.nickname}:{' '}
              </span>
              <span className="text-ink-200">{m.text}</span>
            </li>
          ),
        )}
      </ol>
      <form onSubmit={send} className="flex gap-2 border-t-2 border-ink-700 p-3">
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
          placeholder="Diga oi…"
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
