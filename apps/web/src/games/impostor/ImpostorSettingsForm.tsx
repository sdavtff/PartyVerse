import { EVENTS, type ImpostorSettings } from '@partyverse/shared';
import { useToast } from '../../components/Toast';
import { emitAck } from '../../lib/socket';
import { AiThemeBox } from '../../components/AiThemeBox';
import { CustomListEditor, lines } from '../../components/CustomListEditor';

/** "Local: papel, papel, papel" por linha */
export function parseLocations(text: string) {
  const items: { name: string; roles: string[] }[] = [];
  const errors: string[] = [];
  lines(text).forEach((l, i) => {
    const [name = '', rest = ''] = l.split(':');
    const roles = [
      ...new Set(
        rest
          .split(',')
          .map((r) => r.trim())
          .filter((r) => r.length >= 2),
      ),
    ];
    if (name.trim().length < 2 || name.trim().length > 30)
      return void errors.push(`Linha ${i + 1}: nome do local com 2 a 30 letras`);
    if (roles.length < 3) return void errors.push(`Linha ${i + 1}: escreva pelo menos 3 papéis`);
    if (roles.some((r) => r.length > 30))
      return void errors.push(`Linha ${i + 1}: papel muito longo`);
    items.push({ name: name.trim(), roles: roles.slice(0, 8) });
  });
  return { items: items.slice(0, 30), errors };
}

export function ImpostorSettingsForm({
  settings,
  editable,
}: {
  settings: ImpostorSettings;
  editable: boolean;
}) {
  const toast = useToast();
  const save = (game: Partial<ImpostorSettings>) =>
    emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game }).catch((e) => toast(e.message, 'error'));

  const select = (
    key: 'rounds' | 'discussionSeconds' | 'voteSeconds',
    label: string,
    values: number[],
    fmt: (v: number) => string = String,
  ) => (
    <label className="block">
      <span className="label">{label}</span>
      <select
        className="input py-2"
        disabled={!editable}
        value={settings[key]}
        onChange={(e) => save({ [key]: Number(e.target.value) })}
      >
        {values.map((v) => (
          <option key={v} value={v}>
            {fmt(v)}
          </option>
        ))}
      </select>
    </label>
  );
  const mins = (s: number) =>
    s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)}min ${s % 60}s`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-ink-900 p-4 text-sm text-ink-200">
        <p className="font-bold text-white">Como funciona</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Todos recebem o mesmo local secreto — menos um: o impostor.</li>
          <li>Façam perguntas uns aos outros para descobrir quem não sabe onde está.</li>
          <li>Votem no suspeito. Se o impostor for pego, a turma pontua.</li>
          <li>O impostor ganha se escapar ou se adivinhar o local.</li>
        </ol>
        <p className="mt-2 text-ink-400">
          Melhor com 4 ou mais pessoas, de preferência em chamada de voz.
        </p>
      </div>
      <AiThemeBox kinds={['locations']} editable={editable} />
      <CustomListEditor
        id="locations"
        title="Locais personalizados (opcional)"
        hint="Um por linha: Local: papel, papel, papel (mínimo 3 papéis). Com 4 ou mais locais, a partida usa só os seus."
        placeholder={
          'Nave espacial: Capitã, Piloto, Robô, Passageiro clandestino\nCasa da vó: Vó, Neto, Gato, Vizinha fofoqueira'
        }
        savedCount={Number((settings as Record<string, unknown>).customLocationsCount ?? 0)}
        parse={parseLocations}
        editable={editable}
        onSave={(customLocations) =>
          emitAck(EVENTS.ROOM_UPDATE_SETTINGS, { game: { customLocations } })
            .then(() => toast('Locais salvos!', 'success'))
            .catch((e) => toast((e as Error).message, 'error'))
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {select('rounds', 'Rodadas', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])}
        {select('discussionSeconds', 'Discussão', [60, 90, 120, 180, 240, 300, 420, 600], mins)}
        {select('voteSeconds', 'Votação (s)', [15, 30, 45, 60, 90, 120])}
      </div>
    </div>
  );
}
