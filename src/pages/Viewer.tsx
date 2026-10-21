import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react'
import { Button, Pill } from '../components/ui'
import { statsText } from '../components/StatsLine'
import { ViewerSession, type ViewerState } from '../lib/viewer'
import { rememberViewerRoom } from '../lib/room'
import { normalizeRoom } from '../lib/ids'

export default function Viewer({ room: rawRoom }: { room: string }) {
  const room = normalizeRoom(rawRoom)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [state, setState] = useState<ViewerState>({ signaling: 'connecting', phase: 'aguardando' })
  const [needsTap, setNeedsTap] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    rememberViewerRoom(room)
    const session = new ViewerSession(room, setStream, setState)
    session.start()
    return () => session.stop()
  }, [room])

  // Tenta tocar com som; se o navegador bloquear, toca mudo e pede um toque.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.srcObject = stream
    if (!stream) return
    v.muted = muted
    v.play().catch(() => {
      v.muted = true
      setNeedsTap(true)
      void v.play().catch(() => {})
    })
  }, [stream])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = muted
    v.volume = volume
  }, [muted, volume])

  function enableSound() {
    const v = videoRef.current
    if (!v) return
    v.muted = false
    setMuted(false)
    setNeedsTap(false)
    void v.play().catch(() => {})
  }

  const { phase, signaling, stats } = state
  const tone = phase === 'conectado' ? 'ok' : phase === 'aguardando' ? 'off' : 'warn'
  const label =
    signaling !== 'online'
      ? 'Conectando ao servidor…'
      : phase === 'conectado'
        ? 'Ao vivo'
        : phase === 'conectando'
          ? 'Conectando…'
          : phase === 'reconectando'
            ? 'Reconectando…'
            : 'Aguardando o transmissor'

  return (
    <main className="fixed inset-0 bg-black">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain" />

      <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(.75rem,env(safe-area-inset-top))]">
        <button onClick={() => (location.hash = '')} className="rounded-lg p-2 hover:bg-white/10" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Pill tone={tone}>{label}</Pill>
        {phase === 'conectado' && <span className="truncate text-[11px] text-white/60">{statsText(stats)}</span>}
      </div>

      {phase !== 'conectado' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/60">
          <p>{label}</p>
          {phase === 'aguardando' && signaling === 'online' && (
            <p className="text-xs text-white/40">Abra o modo transmissor no outro celular e toque em “Iniciar transmissão”.</p>
          )}
        </div>
      )}

      {needsTap && phase === 'conectado' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button onClick={enableSound} className="px-6 py-4 text-base">
            <Volume2 className="h-5 w-5" /> Tocar para ativar o som
          </Button>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => (muted || needsTap ? enableSound() : setMuted(true))}
          className="rounded-full bg-white/10 p-3"
          aria-label={muted ? 'Ativar som' : 'Silenciar'}
        >
          {muted || needsTap ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 accent-indigo-400"
          aria-label="Volume"
        />
      </div>
    </main>
  )
}
