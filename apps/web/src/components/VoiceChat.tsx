import { EVENTS, type PublicRoom } from '@partyverse/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHealth } from '../lib/health';
import { emitAck, getSocket } from '../lib/socket';
import { Avatar } from './Avatar';
import { useToast } from './Toast';

const MAX_VOICE = 8;
const DEFAULT_ICE: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

type Signal =
  { type: 'offer' | 'answer'; sdp: string } | { type: 'ice'; candidate: RTCIceCandidateInit };

interface Peer {
  pc: RTCPeerConnection;
  audio: HTMLAudioElement;
  pending: RTCIceCandidateInit[];
  analyser: AnalyserNode | null;
}

/**
 * Chat de voz da sala: cada pessoa conecta direto com as outras (WebRTC, até 8).
 * O servidor só repassa a "apresentação" (oferta/resposta/candidatos) e não ouve o áudio.
 */
export function VoiceChat({ room, myId }: { room: PublicRoom; myId: string }) {
  const toast = useToast();
  const health = useHealth();
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const stream = useRef<MediaStream | null>(null);
  const peers = useRef(new Map<string, Peer>());
  const audioCtx = useRef<AudioContext | null>(null);
  const localAnalyser = useRef<AnalyserNode | null>(null);
  const confirmed = useRef(false);
  const iceServers = health?.iceServers?.length ? health.iceServers : DEFAULT_ICE;

  const inVoice = room.players.filter((p) => p.voice);
  const voiceKey = inVoice.map((p) => p.id).join(',');
  const meInVoice = room.players.find((p) => p.id === myId)?.voice;

  const send = (to: string, data: Signal) =>
    emitAck(EVENTS.VOICE_SIGNAL, { to, data }).catch(() => undefined);

  const analyse = (s: MediaStream) => {
    const ctx = audioCtx.current;
    if (!ctx) return null;
    try {
      const a = ctx.createAnalyser();
      a.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(a);
      return a;
    } catch {
      return null;
    }
  };

  const closePeer = (id: string) => {
    const p = peers.current.get(id);
    if (!p) return;
    p.pc.close();
    p.audio.srcObject = null;
    peers.current.delete(id);
  };

  const makePeer = useCallback(
    (id: string) => {
      closePeer(id);
      const pc = new RTCPeerConnection({ iceServers });
      const audio = new Audio();
      audio.autoplay = true;
      const peer: Peer = { pc, audio, pending: [], analyser: null };
      stream.current?.getTracks().forEach((t) => pc.addTrack(t, stream.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) void send(id, { type: 'ice', candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        const s = e.streams[0] ?? new MediaStream([e.track]);
        audio.srcObject = s;
        void audio.play().catch(() => undefined);
        peer.analyser = analyse(s);
      };
      peers.current.set(id, peer);
      return peer;
    },
    [iceServers],
  );

  const flush = async (p: Peer) => {
    for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => undefined);
  };

  const teardown = useCallback(() => {
    for (const id of [...peers.current.keys()]) closePeer(id);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    localAnalyser.current = null;
    confirmed.current = false;
    setJoined(false);
    setMuted(false);
    setSpeaking(new Set());
  }, []);

  // sinalização recebida dos outros
  useEffect(() => {
    if (!joined) return;
    const s = getSocket();
    const onSignal = async ({ from, data }: { from: string; data: Signal }) => {
      try {
        let p = peers.current.get(from);
        if (data.type === 'offer') {
          p = makePeer(from);
          await p.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
          await flush(p);
          const answer = await p.pc.createAnswer();
          await p.pc.setLocalDescription(answer);
          void send(from, { type: 'answer', sdp: answer.sdp ?? '' });
        } else if (data.type === 'answer' && p) {
          await p.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
          await flush(p);
        } else if (data.type === 'ice' && p) {
          if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.candidate);
          else p.pending.push(data.candidate);
        }
      } catch {
        /* uma conexão que falha não derruba as outras */
      }
    };
    s.on(EVENTS.VOICE_SIGNAL, onSignal);
    return () => {
      s.off(EVENTS.VOICE_SIGNAL, onSignal);
    };
  }, [joined, makePeer]);

  // quem entra ou sai da voz: o de id "menor" de cada par liga para o outro (evita ligação dupla)
  useEffect(() => {
    if (!joined) return;
    const ids = voiceKey ? voiceKey.split(',') : [];
    for (const id of [...peers.current.keys()]) if (!ids.includes(id)) closePeer(id);
    for (const id of ids) {
      if (id === myId || peers.current.has(id) || myId > id) continue;
      const p = makePeer(id);
      void (async () => {
        const offer = await p.pc.createOffer();
        await p.pc.setLocalDescription(offer);
        void send(id, { type: 'offer', sdp: offer.sdp ?? '' });
      })().catch(() => undefined);
    }
  }, [joined, voiceKey, myId, makePeer]);

  // caiu a conexão com o servidor: a voz precisa ser religada
  useEffect(() => {
    if (!joined) return;
    if (meInVoice) confirmed.current = true;
    else if (confirmed.current) {
      teardown();
      toast('O chat de voz caiu com a conexão. Entre de novo quando quiser.', 'error');
    }
  }, [joined, meInVoice, teardown, toast]);

  // quem está falando (volume do microfone/áudio recebido)
  useEffect(() => {
    if (!joined) return;
    const buf = new Uint8Array(256);
    const loud = (a: AnalyserNode | null) => {
      if (!a) return false;
      a.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      return Math.sqrt(sum / buf.length) > 6;
    };
    const t = setInterval(() => {
      const next = new Set<string>();
      if (!muted && loud(localAnalyser.current)) next.add(myId);
      for (const [id, p] of peers.current) if (loud(p.analyser)) next.add(id);
      setSpeaking((prev) =>
        prev.size === next.size && [...next].every((x) => prev.has(x)) ? prev : next,
      );
    }, 250);
    return () => clearInterval(t);
  }, [joined, muted, myId]);

  // sair da página = sair da voz
  useEffect(
    () => () => {
      if (stream.current) {
        void emitAck(EVENTS.VOICE_LEAVE).catch(() => undefined);
        teardown();
      }
    },
    [teardown],
  );

  const join = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !('RTCPeerConnection' in window)) {
      toast('Este navegador não tem chat de voz.', 'error');
      return;
    }
    setBusy(true);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setBusy(false);
      toast('Precisamos do microfone. Libere o acesso no navegador e tente de novo.', 'error');
      return;
    }
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx.current = new Ctx();
      localAnalyser.current = analyse(stream.current);
      await emitAck(EVENTS.VOICE_JOIN);
      setJoined(true);
    } catch (e) {
      teardown();
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    void emitAck(EVENTS.VOICE_LEAVE).catch(() => undefined);
    teardown();
  };

  const toggleMute = () => {
    const next = !muted;
    stream.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
    void emitAck(EVENTS.VOICE_MUTE, { muted: next }).catch(() => undefined);
  };

  const full = !joined && inVoice.length >= MAX_VOICE;
  return (
    <section className="card p-4" aria-label="Chat de voz">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">🎙️ Voz</h2>
        <span className="text-sm text-ink-400">
          {inVoice.length}/{MAX_VOICE}
        </span>
      </div>
      {inVoice.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Quem está na voz">
          {inVoice.map((p) => (
            <li key={p.id} className="flex flex-col items-center gap-0.5" title={p.nickname}>
              <span
                className={`rounded-full p-0.5 transition ${speaking.has(p.id) ? 'bg-lime-400 shadow-[0_0_0_3px_rgba(184,243,74,.35)]' : 'bg-transparent'}`}
              >
                <Avatar avatar={p.avatar} size={34} dim={p.voice === 'muted'} />
              </span>
              <span className="max-w-[4.5rem] truncate text-[11px] font-bold text-ink-300">
                {p.voice === 'muted' ? '🔇 ' : ''}
                {p.id === myId ? 'você' : p.nickname}
              </span>
            </li>
          ))}
        </ul>
      )}
      {joined ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={toggleMute}
            aria-pressed={muted}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition ${muted ? 'bg-pop-rose text-night' : 'bg-ink-700 text-white hover:bg-ink-600'}`}
          >
            {muted ? '🔇 Mudo' : '🎙️ Microfone ligado'}
          </button>
          <button
            onClick={leave}
            className="rounded-xl bg-ink-700 px-3 py-2 text-sm font-bold text-ink-200 hover:text-pop-rose"
          >
            Sair
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={join}
            disabled={busy || full}
            className="mt-3 w-full rounded-xl bg-lime-400 px-3 py-2 text-sm font-bold text-night hover:bg-lime-300 disabled:bg-ink-700 disabled:text-ink-400"
          >
            {busy ? 'Ligando o microfone…' : full ? 'Voz cheia' : 'Entrar na voz'}
          </button>
          <p className="mt-2 text-xs text-ink-400">
            Fale com a sala pelo microfone. Use fone de ouvido para não dar eco.
          </p>
        </>
      )}
    </section>
  );
}
