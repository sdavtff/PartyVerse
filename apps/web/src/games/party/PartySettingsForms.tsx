import {
  EVENTS,
  type MostLikelySettings,
  type TruthDareSettings,
  type TwoTruthsSettings,
} from '@partyverse/shared';
import { CustomListEditor, lines } from '../../components/CustomListEditor';
import { useToast } from '../../components/Toast';
import { emitAck } from '../../lib/socket';

function useSave<T>() {
  const toast = useToast();
  return (game: Partial<T>, ok?: string) =>
    emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game })
      .then(() => ok && toast(ok, 'success'))
      .catch((e) => toast((e as Error).message, 'error'));
}

const parsePhrases = (max: number, len: number) => (text: string) => {
  const errors: string[] = [];
  const items = lines(text).filter((l, i) => {
    if (l.length < 3 || l.length > len) {
      errors.push(`Linha ${i + 1}: use de 3 a ${len} letras`);
      return false;
    }
    return true;
  });
  return { items: [...new Set(items)].slice(0, max), errors };
};

function Select({
  label,
  value,
  options,
  onChange,
  editable,
  suffix = '',
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
  editable: boolean;
  suffix?: string;
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
            {v}
            {suffix}
          </option>
        ))}
      </select>
    </label>
  );
}

function OnlyCustom({
  checked,
  editable,
  onChange,
}: {
  checked: boolean;
  editable: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-end">
      <span className="flex w-full items-center justify-between gap-2 rounded-2xl bg-ink-900 px-3 py-2.5">
        <span className="text-sm font-bold text-ink-200">Só as minhas</span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-lime-400"
          disabled={!editable}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    </label>
  );
}

const Count = (s: unknown, k: string) => Number((s as Record<string, unknown>)[`${k}Count`] ?? 0);

export function MostLikelySettingsForm({
  settings,
  editable,
}: {
  settings: MostLikelySettings;
  editable: boolean;
}) {
  const save = useSave<MostLikelySettings>();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select
          label="Rodadas"
          value={settings.rounds}
          options={[5, 8, 10, 12, 15, 20]}
          editable={editable}
          onChange={(rounds) => save({ rounds })}
        />
        <Select
          label="Tempo para votar"
          value={settings.voteSeconds}
          options={[10, 15, 20, 30, 45]}
          suffix="s"
          editable={editable}
          onChange={(voteSeconds) => save({ voteSeconds })}
        />
        <OnlyCustom
          checked={settings.onlyCustom}
          editable={editable}
          onChange={(onlyCustom) => save({ onlyCustom })}
        />
      </div>
      <CustomListEditor
        id="mostlikely"
        title="Suas frases (opcional)"
        hint='Complete "Quem é mais provável de…" — uma por linha. Elas aparecem primeiro.'
        placeholder={'esquecer o guarda-chuva na casa da vó\nvirar influencer de pão de queijo'}
        savedCount={Count(settings, 'customPrompts')}
        parse={parsePhrases(100, 100)}
        editable={editable}
        onSave={(customPrompts) => save({ customPrompts }, 'Frases salvas!')}
      />
      <p className="text-sm text-ink-400">
        Quem vota na pessoa mais votada ganha 100; a pessoa escolhida ganha 50.
      </p>
    </div>
  );
}

export function TruthDareSettingsForm({
  settings,
  editable,
}: {
  settings: TruthDareSettings;
  editable: boolean;
}) {
  const save = useSave<TruthDareSettings>();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select
          label="Vezes por pessoa"
          value={settings.turnsPerPlayer}
          options={[1, 2, 3]}
          editable={editable}
          onChange={(turnsPerPlayer) => save({ turnsPerPlayer })}
        />
        <Select
          label="Tempo para cumprir"
          value={settings.performSeconds}
          options={[30, 45, 60, 90, 120, 180]}
          suffix="s"
          editable={editable}
          onChange={(performSeconds) => save({ performSeconds })}
        />
        <OnlyCustom
          checked={settings.onlyCustom}
          editable={editable}
          onChange={(onlyCustom) => save({ onlyCustom })}
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CustomListEditor
          id="truths"
          title="Suas verdades (opcional)"
          hint="Uma pergunta por linha."
          placeholder={'Qual foi seu primeiro celular?'}
          savedCount={Count(settings, 'customTruths')}
          parse={parsePhrases(100, 140)}
          editable={editable}
          onSave={(customTruths) => save({ customTruths }, 'Verdades salvas!')}
        />
        <CustomListEditor
          id="dares"
          title="Seus desafios (opcional)"
          hint="Um por linha. Mantenha leve e seguro para todos!"
          placeholder={'Imite o professor de matemática por 10 segundos.'}
          savedCount={Count(settings, 'customDares')}
          parse={parsePhrases(100, 140)}
          editable={editable}
          onSave={(customDares) => save({ customDares }, 'Desafios salvos!')}
        />
      </div>
      <p className="text-sm text-ink-400">
        Verdade cumprida vale 100, desafio vale 150. A turma vota se valeu. Passar a vez não pontua.
      </p>
    </div>
  );
}

export function TwoTruthsSettingsForm({
  settings,
  editable,
}: {
  settings: TwoTruthsSettings;
  editable: boolean;
}) {
  const save = useSave<TwoTruthsSettings>();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select
          label="Rodadas"
          value={settings.rounds}
          options={[1, 2, 3]}
          editable={editable}
          onChange={(rounds) => save({ rounds })}
        />
        <Select
          label="Tempo para escrever"
          value={settings.writeSeconds}
          options={[60, 90, 120, 180, 240]}
          suffix="s"
          editable={editable}
          onChange={(writeSeconds) => save({ writeSeconds })}
        />
        <Select
          label="Tempo para chutar"
          value={settings.guessSeconds}
          options={[15, 20, 25, 30, 45]}
          suffix="s"
          editable={editable}
          onChange={(guessSeconds) => save({ guessSeconds })}
        />
      </div>
      <p className="text-sm text-ink-400">
        Achar a mentira vale 100. O autor ganha 50 por cada pessoa que enganar.
      </p>
    </div>
  );
}
