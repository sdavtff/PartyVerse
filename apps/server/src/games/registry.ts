import type { GameId } from '@partyverse/shared';
import { AppError } from '../lib/errors.js';
import type { AnyGameModule } from './GameModule.js';
import { stopGame } from './stop/stop.game.js';

const modules = new Map<GameId, AnyGameModule>([[stopGame.id, stopGame]]);

export function getGameModule(id: GameId): AnyGameModule {
  const m = modules.get(id);
  if (!m) throw new AppError('INVALID_STATE', 'Este jogo ainda não está disponível', 409);
  return m;
}

export const isGameAvailable = (id: GameId) => modules.has(id);
