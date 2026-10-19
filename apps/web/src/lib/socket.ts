import type { Ack } from '@partyverse/shared';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      withCredentials: true, // autenticação via cookie httpOnly
      autoConnect: false,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
  }
  return socket;
}

/** Reinicia a conexão (ex.: após login/logout, para trocar a identidade). */
export function resetSocket() {
  socket?.disconnect();
  socket = null;
}

export function emitAck<T = unknown>(
  event: string,
  payload: unknown = {},
  timeoutMs = 6000,
): Promise<T> {
  const s = getSocket();
  return new Promise((resolve, reject) => {
    s.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: Ack<T>) => {
      if (err) return reject(new Error('O servidor demorou a responder. Tente novamente.'));
      if (res.ok) resolve(res.data);
      else reject(Object.assign(new Error(res.error.message), { code: res.error.code }));
    });
  });
}

let counter = 0;
export const actionId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;
