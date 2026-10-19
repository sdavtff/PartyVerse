import {
  EVENTS,
  type ChatMessage,
  type MatchResult,
  type MatchReward,
  type PublicRoom,
} from '@partyverse/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { syncClock } from './clock';
import { emitAck, getSocket } from './socket';

export type ConnStatus =
  'connecting' | 'online' | 'reconnecting' | 'failed' | 'kicked' | 'replaced' | 'password';

/** Mantém a conexão com uma sala: entra, reconecta e acumula o estado vindo do servidor. */
export function useRoom(code: string) {
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [game, setGame] = useState<unknown>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [reward, setReward] = useState<MatchReward | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const left = useRef(false);
  const gameEvents = useRef(new Set<(ev: unknown) => void>());
  /** Assina eventos leves do jogo (ex.: traços do desenho). Retorna a função para cancelar. */
  const onGameEvent = useCallback((fn: (ev: unknown) => void) => {
    gameEvents.current.add(fn);
    return () => void gameEvents.current.delete(fn);
  }, []);

  const password = useRef<string | undefined>(undefined);
  const join = useCallback(
    async (pass?: string) => {
      if (pass !== undefined) password.current = pass;
      try {
        const r = await emitAck<PublicRoom>(EVENTS.ROOM_JOIN, {
          code,
          ...(password.current ? { password: password.current } : {}),
        });
        setRoom(r);
        setStatus('online');
        setError(null);
      } catch (e) {
        const err = e as Error & { code?: string };
        setStatus(err.code === 'PASSWORD_REQUIRED' ? 'password' : 'failed');
        setError(err.message);
      }
    },
    [code],
  );

  useEffect(() => {
    const s = getSocket();
    left.current = false;
    const onConnect = () => void join();
    const onGameEvent = (ev: unknown) => gameEvents.current.forEach((fn) => fn(ev));
    const onDisconnect = (reason: string) => {
      if (left.current) return;
      setStatus(reason === 'io client disconnect' ? 'failed' : 'reconnecting');
    };
    const onConnectError = (err: Error) => {
      if (err.message === 'UNAUTHORIZED') {
        setStatus('failed');
        setError('Sua sessão expirou. Recarregue a página.');
      } else setStatus('reconnecting');
    };
    const onState = (r: PublicRoom) => setRoom(r);
    const onChat = (m: ChatMessage) => setChat((xs) => [...xs.slice(-99), m]);
    const onHistory = (ms: ChatMessage[]) => setChat(ms);
    const onGame = (g: unknown) => {
      if (g && typeof g === 'object') syncClock((g as { serverNow?: unknown }).serverNow);
      setGame(g);
      if (g === null) setResult(null);
    };
    const onResult = (r: MatchResult) => {
      setResult(r);
      setReward(null);
    };
    const onReward = (r: MatchReward) => setReward(r);
    const onKicked = () => {
      left.current = true;
      setStatus('kicked');
    };
    const onNotice = (n: { message: string }) => {
      setStatus('replaced');
      setError(n.message);
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    s.on(EVENTS.ROOM_STATE, onState);
    s.on(EVENTS.CHAT_MESSAGE, onChat);
    s.on(EVENTS.CHAT_HISTORY, onHistory);
    s.on(EVENTS.GAME_STATE, onGame);
    s.on(EVENTS.GAME_RESULT, onResult);
    s.on(EVENTS.REWARD, onReward);
    s.on(EVENTS.ROOM_KICKED, onKicked);
    s.on(EVENTS.NOTICE, onNotice);
    s.on(EVENTS.GAME_EVENT, onGameEvent);
    if (s.connected) void join();
    else s.connect();

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      s.off(EVENTS.ROOM_STATE, onState);
      s.off(EVENTS.CHAT_MESSAGE, onChat);
      s.off(EVENTS.CHAT_HISTORY, onHistory);
      s.off(EVENTS.GAME_STATE, onGame);
      s.off(EVENTS.GAME_RESULT, onResult);
      s.off(EVENTS.REWARD, onReward);
      s.off(EVENTS.ROOM_KICKED, onKicked);
      s.off(EVENTS.NOTICE, onNotice);
      s.off(EVENTS.GAME_EVENT, onGameEvent);
    };
  }, [join]);

  const leave = useCallback(async () => {
    left.current = true;
    await emitAck(EVENTS.ROOM_LEAVE).catch(() => undefined);
  }, []);

  // quando a partida volta ao lobby, limpa o resultado
  useEffect(() => {
    if (room?.phase === 'lobby') {
      setResult(null);
      setGame(null);
    }
  }, [room?.phase]);

  return { room, chat, game, result, reward, status, error, rejoin: join, leave, onGameEvent };
}
