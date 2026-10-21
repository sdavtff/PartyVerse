import {
  EVENTS,
  QUIZ_CATEGORIES,
  type CustomQuestion,
  type QuizSettings,
} from '@partyverse/shared';
import { CustomListEditor, lines } from '../../components/CustomListEditor';
import { useToast } from '../../components/Toast';
import { emitAck } from '../../lib/socket';
import { AiThemeBox } from '../../components/AiThemeBox';

const LABELS: Record<QuizSettings['category'], string> = {
  misto: 'Misto',
  geral: 'Gerais',
  ciencia: 'Ciência',
  geografia: 'Geografia',
  historia: 'História',
  esportes: 'Esportes',
  entretenimento: 'Entretenimento',
  anime: 'Anime',
  games: 'Games',
  musica: 'Música BR',
  futebol: 'Futebol',
  personalizado: '✍️ Personalizado',
};

/** "pergunta | certa | errada | errada | errada" por linha */
export function parseQuestions(text: string) {
  const items: CustomQuestion[] = [];
  const errors: string[] = [];
  lines(text).forEach((l, i) => {
    const parts = l.split('|').map((p) => p.trim());
    if (parts.length !== 5 || parts.some((p) => !p)) {
      errors.push(`Linha ${i + 1}: use 5 partes separadas por |`);
      return;
    }
    const [q, a, w1, w2, w3] = parts as [string, string, string, string, string];
    if (q.length < 3 || q.length > 160)
      return void errors.push(`Linha ${i + 1}: pergunta muito curta ou longa`);
    if ([a, w1, w2, w3].some((x) => x.length > 60))
      return void errors.push(`Linha ${i + 1}: resposta com mais de 60 letras`);
    items.push({ q, a, w: [w1, w2, w3] });
  });
  return { items: items.slice(0, 60), errors };
}

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
      <AiThemeBox kinds={['quiz']} editable={editable} />
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
                className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition disabled:cursor-default ${on ? 'border-pop-sky bg-pop-sky text-night' : 'border-ink-600 text-ink-200 enabled:hover:border-ink-400'}`}
              >
                {LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>
      {settings.category === 'personalizado' && (
        <CustomListEditor
          id="quiz"
          title="Suas perguntas"
          hint="Uma por linha: pergunta | resposta certa | errada | errada | errada. Se faltar pergunta, completamos com o tema misto."
          placeholder={'Qual é a cor favorita da Ana? | Roxo | Azul | Verde | Preto'}
          savedCount={Number((settings as Record<string, unknown>).customQuestionsCount ?? 0)}
          parse={parseQuestions}
          editable={editable}
          onSave={(items) =>
            emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game: { customQuestions: items } })
              .then(() => toast('Perguntas salvas!', 'success'))
              .catch((e) => toast((e as Error).message, 'error'))
          }
        />
      )}
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
