import { EVENTS, QUIZ_CATEGORIES, type QuizSettings } from '@partyverse/shared';
import { useToast } from '../../components/Toast';
import { emitAck } from '../../lib/socket';

const LABELS: Record<QuizSettings['category'], string> = {
  misto: 'Misto',
  geral: 'Gerais',
  ciencia: 'Ciência',
  geografia: 'Geografia',
  historia: 'História',
  esportes: 'Esportes',
  entretenimento: 'Entretenimento',
};

export function QuizSettingsForm({
  settings,
  editable,
}: {
  settings: QuizSettings;
  editable: boolean;
}) {
  const toast = useToast();
  const save = (game: Partial<QuizSettings>) =>
    emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game }).catch((e) => toast(e.message, 'error'));

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Tema</p>
        <div className="flex flex-wrap gap-2">
          {QUIZ_CATEGORIES.map((c) => {
            const on = settings.category === c;
            return (
              <button
                key={c}
                type="button"
                disabled={!editable}
                aria-pressed={on}
                onClick={() => save({ category: c })}
                className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition disabled:cursor-default ${on ? 'border-pop-sky bg-pop-sky text-ink-950' : 'border-ink-600 text-ink-200 enabled:hover:border-ink-400'}`}
              >
                {LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Perguntas</span>
          <select
            className="input py-2"
            disabled={!editable}
            value={settings.questions}
            onChange={(e) => save({ questions: Number(e.target.value) })}
          >
            {[5, 8, 10, 12, 15, 20].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Tempo por pergunta</span>
          <select
            className="input py-2"
            disabled={!editable}
            value={settings.secondsPerQuestion}
            onChange={(e) => save({ secondsPerQuestion: Number(e.target.value) })}
          >
            {[8, 10, 12, 15, 20, 25, 30].map((v) => (
              <option key={v} value={v}>
                {v}s
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-sm text-ink-400">
        Acerto vale de 500 a 1000 pontos — quanto mais rápido, mais. A partir de 3 acertos seguidos,
        cada acerto ganha +100 de bônus.
      </p>
    </div>
  );
}
