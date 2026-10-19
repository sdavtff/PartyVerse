import { EVENTS, WORD_CATEGORIES, type GameId, type GuessSettings } from '@partyverse/shared';
import { CustomListEditor, lines } from '../../components/CustomListEditor';
import { useToast } from '../../components/Toast';
import { emitAck } from '../../lib/socket';

const CAT_LABEL: Record<GuessSettings['category'], string> = {
  misto: 'Misto',
  animais: 'Animais',
  comidas: 'Comidas',
  objetos: 'Objetos',
  lugares: 'Lugares',
  profissoes: 'Profissões',
  acoes: 'Ações',
  anime: 'Anime',
  games: 'Games',
  musica: 'Música',
  futebol: 'Futebol',
  personalizado: '✍️ Personalizado',
};

export function parseWords(text: string) {
  const errors: string[] = [];
  const items = [
    ...new Set(
      lines(text).filter((w, i) => {
        if (w.length < 2 || w.length > 30) {
          errors.push(`Linha ${i + 1}: use de 2 a 30 letras`);
          return false;
        }
        return true;
      }),
    ),
  ].slice(0, 200);
  return { items, errors };
}

const HOW: Record<string, string[]> = {
  draw: [
    'Na sua vez, escolha uma de 3 palavras e desenhe.',
    'Os outros chutam no chat. Quanto mais rápido, mais pontos.',
    'Quem desenha ganha pontos por cada pessoa que acerta.',
    'Letras da palavra vão aparecendo como dica.',
  ],
  charades: [
    'Na sua vez, escolha uma palavra e imite — sem falar!',
    'Joguem em chamada de vídeo ou no mesmo lugar.',
    'A turma chuta no chat; quem acerta primeiro leva mais.',
  ],
  secretword: [
    'Na sua vez, escolha a palavra secreta e mande dicas curtas.',
    'Cada dica a mais diminui os pontos de quem acertar.',
    'A dica não pode conter a palavra.',
  ],
};

export function GuessSettingsForm({
  gameId,
  settings,
  editable,
}: {
  gameId: GameId;
  settings: GuessSettings;
  editable: boolean;
}) {
  const toast = useToast();
  const save = (game: Partial<GuessSettings>) =>
    emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game }).catch((e) => toast(e.message, 'error'));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink-900 p-4 text-sm text-ink-200">
        <p className="font-bold text-white">Como funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {(HOW[gameId] ?? []).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="label">Tema das palavras</p>
        <div className="flex flex-wrap gap-2">
          {WORD_CATEGORIES.map((c) => {
            const on = settings.category === c;
            return (
              <button
                key={c}
                type="button"
                disabled={!editable}
                aria-pressed={on}
                onClick={() => save({ category: c })}
                className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition disabled:cursor-default ${on ? 'border-pop-pink bg-pop-pink text-night' : 'border-ink-600 text-ink-200 enabled:hover:border-ink-400'}`}
              >
                {CAT_LABEL[c]}
              </button>
            );
          })}
        </div>
      </div>
      {settings.category === 'personalizado' && (
        <CustomListEditor
          id="words"
          title="Suas palavras"
          hint="Uma palavra ou expressão por linha (nomes da turma, piadas internas…). Com menos de 3, completamos com o tema misto."
          placeholder={'tia Lurdes\nchurrasco de domingo\ncachorro do vizinho'}
          savedCount={Number((settings as Record<string, unknown>).customWordsCount ?? 0)}
          parse={parseWords}
          editable={editable}
          onSave={(items) =>
            emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game: { customWords: items } })
              .then(() => toast('Palavras salvas!', 'success'))
              .catch((e) => toast((e as Error).message, 'error'))
          }
        />
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="label">Rodadas</span>
          <select
            className="input py-2"
            disabled={!editable}
            value={settings.rounds}
            onChange={(e) => save({ rounds: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Tempo por vez</span>
          <select
            className="input py-2"
            disabled={!editable}
            value={settings.turnSeconds}
            onChange={(e) => save({ turnSeconds: Number(e.target.value) })}
          >
            {[45, 60, 80, 90, 120, 150, 180].map((v) => (
              <option key={v} value={v}>
                {v}s
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end">
          <span className="flex w-full items-center justify-between gap-2 rounded-2xl bg-ink-900 px-3 py-2.5">
            <span className="text-sm font-bold text-ink-200">Dicas de letras</span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-lime-400"
              disabled={!editable}
              checked={settings.letterHints}
              onChange={(e) => save({ letterHints: e.target.checked })}
            />
          </span>
        </label>
        {gameId === 'secretword' && (
          <label className="block">
            <span className="label">Máx. de dicas</span>
            <select
              className="input py-2"
              disabled={!editable}
              value={settings.maxClues}
              onChange={(e) => save({ maxClues: Number(e.target.value) })}
            >
              {[3, 4, 5, 6, 8, 10].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="text-xs text-ink-400">Cada pessoa tem uma vez por rodada.</p>
    </div>
  );
}
