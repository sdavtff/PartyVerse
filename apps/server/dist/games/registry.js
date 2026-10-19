import { AppError } from '../lib/errors.js';
import { charadesGame, drawGame, secretWordGame } from './guess/guess.game.js';
import { impostorGame } from './impostor/impostor.game.js';
import { quizGame } from './quiz/quiz.game.js';
import { stopGame } from './stop/stop.game.js';
const modules = new Map([stopGame, impostorGame, quizGame, drawGame, charadesGame, secretWordGame].map((m) => [
    m.id,
    m,
]));
export function getGameModule(id) {
    const m = modules.get(id);
    if (!m)
        throw new AppError('INVALID_STATE', 'Este jogo ainda não está disponível', 409);
    return m;
}
export const isGameAvailable = (id) => modules.has(id);
