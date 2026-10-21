import type { GameId, Highlights } from '@partyverse/shared';
import type { ZodType, ZodTypeDef } from 'zod';
import type { GameAi } from '../modules/ai/ai.service.js';

export interface GamePlayer {
  id: string;
  nickname: string;
}

/** Serviços que a sala oferece ao jogo. O jogo nunca fala com sockets diretamente. */
export interface GameContext {
  now(): number;
  /** Agenda um temporizador nomeado; reagendar com o mesmo nome substitui o anterior. */
  setTimer(name: string, ms: number, fn: () => void): void;
  clearTimer(name: string): void;
  /** Envia a cada jogador a sua visão atualizada. */
  sync(): void;
  /** Mensagem de sistema no chat da sala. */
  notice(text: string): void;
  /** Mensagem no chat com destaque (ex.: "Fulano acertou!"). */
  announce(text: string, kind: 'guess-correct' | 'guess-close'): void;
  /** Mensagem do sistema visível só para um jogador. */
  whisper(playerId: string, text: string, kind?: 'whisper' | 'guess-close'): void;
  /** Mensagem de chat de um jogador entregue só a alguns (ex.: quem já acertou). */
  chatTo(fromId: string, text: string, recipients: string[]): void;
  /** Evento leve do jogo (ex.: traços de desenho) para todos, menos `except`. */
  emit(payload: unknown, except?: string): void;
  nickname(playerId: string): string;
  isOnline(playerId: string): boolean;
  /** Sinaliza que a partida terminou; a sala calcula o ranking e persiste. */
  finish(): void;
  /** IA (opcional; só existe quando a chave está configurada). */
  ai?: GameAi;
}

/**
 * Contrato comum dos minijogos. Cada módulo é dono do seu estado, regras e ciclo de vida;
 * a sala só orquestra (entrada/saída, temporizadores, envio de visões e resultado).
 */
export interface GameModule<State, Settings, Action> {
  id: GameId;
  minPlayers: number;
  settingsSchema: ZodType<Settings, ZodTypeDef, unknown>;
  defaultSettings(): Settings;
  /** Cria o estado inicial a partir dos jogadores presentes no início. */
  createInitialState(players: GamePlayer[], settings: Settings): State;
  /** Começa a próxima rodada (sorteios, prazos). */
  startRound(state: State, ctx: GameContext): void;
  /** Valida forma e permissão da ação; lança AppError se inválida. */
  validateAction(state: State, playerId: string, raw: unknown): Action;
  /** Aplica uma ação já validada. Deve ser idempotente quando a ação se repete. */
  processAction(state: State, playerId: string, action: Action, ctx: GameContext): void;
  /** Avança para a próxima fase (chamado por temporizadores ou condições internas). */
  advancePhase(state: State, ctx: GameContext): void;
  /** Placar acumulado da partida. */
  calculateScores(state: State): Record<string, number>;
  /** Jogadores vencedores (empates possíveis). */
  determineWinners(state: State): string[];
  /** Destaques por jogador para conquistas (opcional). */
  highlights?(state: State): Highlights;
  /** Resumo final para persistência. */
  finalize(state: State): { rounds: number };
  /** Visão filtrada para um jogador (null = espectador). Nunca incluir segredos de outros. */
  viewFor(state: State, playerId: string | null): unknown;
  isParticipant(state: State, playerId: string): boolean;
  onPlayerLeft?(state: State, playerId: string, ctx: GameContext): void;
  /** Jogos de adivinhação podem consumir mensagens do chat (ex.: palpites). */
  onChat?(state: State, playerId: string, text: string, ctx: GameContext): { consumed: boolean };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any, any>;
