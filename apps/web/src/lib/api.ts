import type { ServerError } from '@partyverse/shared';

export class ApiError extends Error {
  constructor(
    public code: ServerError['code'] | 'NETWORK',
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'include',
      ...rest,
      headers: {
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...rest.headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError('NETWORK', 'Sem conexão com o servidor. Verifique sua internet.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (body as { error?: ServerError }).error;
    throw new ApiError(e?.code ?? 'INTERNAL', e?.message ?? 'Algo deu errado', res.status);
  }
  return body as T;
}

export interface Identity {
  id: string;
  nickname: string;
  avatar: string;
  isGuest: boolean;
}
