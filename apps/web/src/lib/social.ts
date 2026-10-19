import { api } from './api';

export type FriendStatus = 'friend' | 'incoming' | 'outgoing';
export interface FriendUser {
  id: string;
  nickname: string;
  avatar: string;
  level?: number;
}
export interface FriendEntry {
  user: FriendUser;
  status: FriendStatus;
  online: boolean;
  room: { code: string; name: string; gameId: string; phase: string } | null;
}

export const friendsApi = {
  list: () => api<FriendEntry[]>('/friends'),
  relation: (id: string) => api<{ status: FriendStatus | null }>(`/friends/relation/${id}`),
  add: (id: string) => api<{ status: FriendStatus }>(`/friends/${id}`, { method: 'POST' }),
  remove: (id: string) => api<{ status: null }>(`/friends/${id}`, { method: 'DELETE' }),
  invite: (id: string) => api<{ ok: true }>(`/friends/${id}/invite`, { method: 'POST' }),
  search: (q: string) => api<FriendUser[]>(`/users?q=${encodeURIComponent(q)}`),
};

export interface InvitePayload {
  kind: 'room' | 'friend-request';
  from: FriendUser;
  room?: { code: string; name: string; gameId: string };
}
