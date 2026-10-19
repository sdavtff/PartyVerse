import { EVENTS, type ImpostorSettings } from '@partyverse/shared';
import { useToast } from '../../components/Toast';
import { emitAck } from '../../lib/socket';

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
    key: keyof ImpostorSettings,
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {select('rounds', 'Rodadas', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])}
        {select('discussionSeconds', 'Discussão', [60, 90, 120, 180, 240, 300, 420, 600], mins)}
        {select('voteSeconds', 'Votação (s)', [15, 30, 45, 60, 90, 120])}
      </div>
    </div>
  );
}
