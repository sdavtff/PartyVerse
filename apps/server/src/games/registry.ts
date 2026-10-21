import type { GameId } from '@partyverse/shared';
import { AppError } from '../lib/errors.js';
import type { AnyGameModule } from './GameModule.js';
import { charadesGame, drawGame, secretWordGame } from './guess/guess.game.js';
import { impostorGame } from './impostor/impostor.game.js';
import { quizGame } from './quiz/quiz.game.js';
import { mostLikelyGame } from './party/mostlikely.game.js';
import { truthDareGame } from './party/truthdare.game.js';
import { twoTruthsGame } from './party/twotruths.game.js';
import { stopGame } from './stop/stop.game.js';
import { spiesGame } from './spies/spies.game.js';
import { telephoneGame } from './telephone/telephone.game.js';
import { checkersGame } from './classic/checkers.game.js';
import { hangmanGame } from './classic/hangman.game.js';
import { ticTacToeGame } from './classic/tictactoe.game.js';

const modules = new Map<GameId, AnyGameModule>(
  [
    stopGame,
    impostorGame,
    quizGame,
    drawGame,
    charadesGame,
    secretWordGame,
    mostLikelyGame,
    truthDareGame,
    twoTruthsGame,
    hangmanGame,
    ticTacToeGame,
    checkersGame,
    telephoneGame,
    spiesGame,
  ].map((m) => [m.id, m as AnyGameModule]),
);

export function getGameModule(id: GameId): AnyGameModule {
  const m = modules.get(id);
  if (!m) throw new AppError('INVALID_STATE', 'Este jogo ainda não está disponível', 409);
  return m;
}

export const isGameAvailable = (id: GameId) => modules.has(id);
