import {
  EVENTS,
  WORD_CATEGORIES,
  type CheckersSettings,
  type HangmanSettings,
  type TicTacToeSettings,
} from '@partyverse/shared';
import { AiThemeBox } from '../../components/AiThemeBox';
import { CustomListEditor } from '../../components/CustomListEditor';
import { useToast } from '../../components/Toast';
import { emitAck } from '../../lib/socket';
import { parseWords } from '../guess/GuessSettingsForm';

function useSave<T>() {
  const toast = useToast();
  return (game: Partial<T>, ok?: string) =>
    emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game })
      .then(() => ok && toast(ok, 'success'))
      .catch((e) => toast((e as Error).message, 'error'));
}

function Select({
  label,
  value,
  options,
  onChange,
  editable,
  fmt = String,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
  editable: boolean;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select
        className="input py-2"
        disabled={!editable}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map((v) => (
          <option key={v} value={v}>
            {fmt(v)}
          </option>
        ))}
      </select>
    </label>
  );
}

const CAT: Record<HangmanSettings['category'], string> = {
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

export function HangmanSettingsForm({
  settings,
  editable,
}: {
  settings: HangmanSettings;
  editable: boolean;
}) {
  const save = useSave<HangmanSettings>();
  return (
    <div className="space-y-4">
      <AiThemeBox kinds={['words']} editable={editable} />
      <div>
        <p className="label">Tema das palavras</p>
        <div className="flex flex-wrap gap-2">
          {WORD_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!editable}
              aria-pressed={settings.category === c}
              onClick={() => save({ category: c })}
              className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition disabled:cursor-default ${settings.category === c ? 'border-pop-amber bg-pop-amber text-night' : 'border-ink-600 text-ink-200 enabled:hover:border-ink-400'}`}
            >
              {CAT[c]}
            </button>
          ))}
        </div>
      </div>
      {settings.category === 'personalizado' && (
        <CustomListEditor
          id="hangman"
          title="Suas palavras"
          hint="Uma por linha, só letras (pode ter espaço). Com menos de 3, completamos com o tema misto."
          placeholder={'paralelepípedo\nfeijoada\nmontanha-russa'}
          savedCount={Number((settings as Record<string, unknown>).customWordsCount ?? 0)}
          parse={parseWords}
          editable={editable}
          onSave={(customWords) => save({ customWords }, 'Palavras salvas!')}
        />
      )}
      <div className="grid grid-cols-3 gap-3">
        <Select
          label="Palavras"
          value={settings.rounds}
          options={[3, 5, 7, 10]}
          editable={editable}
          onChange={(rounds) => save({ rounds })}
        />
        <Select
          label="Tempo por vez"
          value={settings.turnSeconds}
          options={[10, 15, 20, 30, 45, 60]}
          fmt={(v) => `${v}s`}
          editable={editable}
          onChange={(turnSeconds) => save({ turnSeconds })}
        />
        <Select
          label="Vidas"
          value={settings.lives}
          options={[4, 5, 6, 7, 8, 10]}
          editable={editable}
          onChange={(lives) => save({ lives })}
        />
      </div>
      <p className="text-sm text-ink-400">
        Em turnos: letra certa vale 10 por vez que aparece e a pessoa joga de novo; letra errada
        tira uma vida de todos. Dá para jogar sozinho também.
      </p>
    </div>
  );
}

export function TicTacToeSettingsForm({
  settings,
  editable,
}: {
  settings: TicTacToeSettings;
  editable: boolean;
}) {
  const save = useSave<TicTacToeSettings>();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Melhor de"
          value={settings.games}
          options={[1, 3, 5, 7, 9]}
          fmt={(v) => `${v} ${v === 1 ? 'partida' : 'partidas'}`}
          editable={editable}
          onChange={(games) => save({ games })}
        />
        <Select
          label="Tempo por jogada"
          value={settings.turnSeconds}
          options={[5, 10, 15, 20, 30, 60]}
          fmt={(v) => `${v}s`}
          editable={editable}
          onChange={(turnSeconds) => save({ turnSeconds })}
        />
      </div>
      <p className="text-sm text-ink-400">
        Jogam os 2 primeiros da lista de jogadores; os demais assistem e torcem (dá para usar
        &quot;Só assistir&quot;). Se o tempo acabar, a jogada é automática.
      </p>
    </div>
  );
}

export function CheckersSettingsForm({
  settings,
  editable,
}: {
  settings: CheckersSettings;
  editable: boolean;
}) {
  const save = useSave<CheckersSettings>();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Partidas"
          value={settings.games}
          options={[1, 2, 3, 5]}
          editable={editable}
          onChange={(games) => save({ games })}
        />
        <Select
          label="Tempo por lance"
          value={settings.turnSeconds}
          options={[15, 30, 45, 60, 90, 120, 180]}
          fmt={(v) => `${v}s`}
          editable={editable}
          onChange={(turnSeconds) => save({ turnSeconds })}
        />
      </div>
      <p className="text-sm text-ink-400">
        Regras brasileiras: peão captura para frente e para trás, captura é obrigatória e vale a
        jogada que pega mais peças; a dama anda várias casas. Jogam os 2 primeiros da lista.
      </p>
    </div>
  );
}
