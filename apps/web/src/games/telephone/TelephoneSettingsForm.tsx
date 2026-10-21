import {
  EVENTS,
  WORD_CATEGORIES,
  type SpiesSettings,
  type TelephoneSettings,
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

export function TelephoneSettingsForm({
  settings,
  editable,
}: {
  settings: TelephoneSettings;
  editable: boolean;
}) {
  const save = useSave<TelephoneSettings>();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink-900 p-4 text-sm text-ink-200">
        <p className="font-bold text-white">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Cada um escreve uma frase maluca.</li>
          <li>
            As frases giram: o próximo desenha, o seguinte descreve o desenho, e assim por diante.
          </li>
          <li>No fim, os cadernos são revelados página por página. Curta as melhores ❤️</li>
        </ol>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Select
          label="Tempo p/ escrever"
          value={settings.writeSeconds}
          options={[20, 30, 45, 60, 90]}
          fmt={(v) => `${v}s`}
          editable={editable}
          onChange={(writeSeconds) => save({ writeSeconds })}
        />
        <Select
          label="Tempo p/ desenhar"
          value={settings.drawSeconds}
          options={[45, 60, 80, 100, 120, 180]}
          fmt={(v) => `${v}s`}
          editable={editable}
          onChange={(drawSeconds) => save({ drawSeconds })}
        />
        <Select
          label="Passos"
          value={settings.steps}
          options={[0, 3, 4, 5, 6, 8]}
          fmt={(v) => (v === 0 ? 'Um por pessoa' : String(v))}
          editable={editable}
          onChange={(steps) => save({ steps })}
        />
      </div>
      <p className="text-sm text-ink-400">
        Cada página entregue vale 5 pontos e cada ❤️ recebido vale 10.
      </p>
    </div>
  );
}

const CAT: Record<SpiesSettings['category'], string> = {
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

export function SpiesSettingsForm({
  settings,
  editable,
}: {
  settings: SpiesSettings;
  editable: boolean;
}) {
  const save = useSave<SpiesSettings>();
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink-900 p-4 text-sm text-ink-200">
        <p className="font-bold text-white">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Dois times (🔴 e 🔵), cada um com um mestre 🕶️ que vê a cor de todas as cartas.</li>
          <li>
            Na vez do time, o mestre dá UMA palavra de dica e um número (quantas cartas ela liga).
          </li>
          <li>O time escolhe as cartas. Errou (neutra ou do outro time)? A vez passa.</li>
          <li>
            Ganha quem achar todas as suas cartas primeiro. Tocou no assassino 💀? Perdeu na hora!
          </li>
        </ol>
      </div>
      <AiThemeBox kinds={['words']} editable={editable} />
      <div>
        <p className="label">Tema das cartas</p>
        <div className="flex flex-wrap gap-2">
          {WORD_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              disabled={!editable}
              aria-pressed={settings.category === c}
              onClick={() => save({ category: c })}
              className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition disabled:cursor-default ${settings.category === c ? 'border-pop-rose bg-pop-rose text-night' : 'border-ink-600 text-ink-200 enabled:hover:border-ink-400'}`}
            >
              {CAT[c]}
            </button>
          ))}
        </div>
      </div>
      {settings.category === 'personalizado' && (
        <CustomListEditor
          id="spies"
          title="Suas palavras"
          hint="Uma palavra por linha (até 12 letras, sem espaço). Faltando, completamos com o tema misto."
          placeholder={'praia\\nfoguete\\nchocolate'}
          savedCount={Number((settings as Record<string, unknown>).customWordsCount ?? 0)}
          parse={parseWords}
          editable={editable}
          onSave={(customWords) => save({ customWords }, 'Palavras salvas!')}
        />
      )}
      <div className="grid grid-cols-3 gap-3">
        <Select
          label="Partidas"
          value={settings.games}
          options={[1, 2, 3]}
          editable={editable}
          onChange={(games) => save({ games })}
        />
        <Select
          label="Tempo da dica"
          value={settings.clueSeconds}
          options={[30, 60, 90, 120, 180, 240]}
          fmt={(v) => `${v}s`}
          editable={editable}
          onChange={(clueSeconds) => save({ clueSeconds })}
        />
        <Select
          label="Tempo p/ chutar"
          value={settings.guessSeconds}
          options={[60, 90, 120, 150, 180, 240, 300]}
          fmt={(v) => `${v}s`}
          editable={editable}
          onChange={(guessSeconds) => save({ guessSeconds })}
        />
      </div>
      <p className="text-sm text-ink-400">
        Mínimo de 4 pessoas. Melhor em chamada de voz para o time conversar (o mestre fica quieto!).
      </p>
    </div>
  );
}
