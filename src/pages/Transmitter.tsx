import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Moon, Radio, Share2, Square, RefreshCw } from 'lucide-react'
import { Button, Field, Pill, selectClass } from '../components/ui'
import { statsText } from '../components/StatsLine'
import { DEFAULT_CAPTURE, listCameras, openCamera, stopStream, type CaptureOptions } from '../lib/media'
import { TransmitterSession, type ViewerInfo } from '../lib/transmitter'
import type { SignalStatus } from '../lib/signaling'
import { KeepAwake } from '../lib/wakeLock'
import { newTransmitterRoom, transmitterRoom, viewerLink } from '../lib/room'
import { formatRoom } from '../lib/ids'

const OPTS_KEY = 'babycam.captura'

function loadOpts(): CaptureOptions {
  try {
    return { ...DEFAULT_CAPTURE, ...JSON.parse(localStorage.getItem(OPTS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_CAPTURE
  }
}

export default function Transmitter() {
  const [room, setRoom] = useState(transmitterRoom)
  const [opts, setOpts] = useState(loadOpts)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [viewers, setViewers] = useState<ViewerInfo[]>([])
  const [sig, setSig] = useState<SignalStatus>('offline')
  const [dim, setDim] = useState(false)
  const [copied, setCopied] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef<TransmitterSession | null>(null)
  const awake = useRef(new KeepAwake())

  // Abre (ou reabre) a câmera sempre que as opções mudam.
  useEffect(() => {
    let cancelled = false
    try {
      localStorage.setItem(OPTS_KEY, JSON.stringify(opts))
    } catch {
      /* sem armazenamento */
    }
    ;(async () => {
      // Android não abre a mesma câmera duas vezes: solta a anterior antes.
      stopStream(streamRef.current)
      streamRef.current = null
      try {
        const s = await openCamera(opts)
        if (cancelled) return stopStream(s)
        streamRef.current = s
        setStream(s)
        setError(null)
        await sessionRef.current?.setStream(s)
        setCameras(await listCameras())
      } catch (e) {
        if (!cancelled) setError(cameraError(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [opts])

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  // Liga/desliga a transmissão.
  useEffect(() => {
    if (!live || !streamRef.current) return
    const session = new TransmitterSession(room, streamRef.current, (v, s) => {
      setViewers(v)
      setSig(s)
    })
    sessionRef.current = session
    session.start()
    void awake.current.enable()
    return () => {
      session.stop()
      sessionRef.current = null
      awake.current.disable()
      setViewers([])
      setSig('offline')
    }
  }, [live, room])

  // Ao sair da tela: fecha tudo.
  useEffect(() => () => stopStream(streamRef.current), [])

  const link = viewerLink(room)
  const connected = viewers.filter((v) => v.state === 'connected')

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: 'Babycam', text: 'Assistir o bebê', url: link }).catch(() => {})
    } else {
      await navigator.clipboard?.writeText(link).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function update(patch: Partial<CaptureOptions>) {
    setOpts((o) => ({ ...o, ...patch }))
  }

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col gap-4 px-4 pt-4 pb-10">
      <header className="flex items-center gap-2">
        <button onClick={() => (location.hash = '')} className="rounded-lg p-2 hover:bg-white/10" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-semibold">Transmissor</h1>
        {live ? (
          sig === 'online' ? (
            <Pill tone="ok">No ar · {connected.length} assistindo</Pill>
          ) : (
            <Pill tone="warn">Reconectando…</Pill>
          )
        ) : (
          <Pill tone="off">Parado</Pill>
        )}
      </header>

      <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-rose-200">
            {error}
          </div>
        )}
      </div>

      <section className="grid grid-cols-2 gap-3 rounded-2xl bg-white/5 p-4">
        <Field label="Câmera">
          <select
            className={selectClass}
            value={opts.deviceId ?? opts.facing}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'environment' || v === 'user') update({ facing: v, deviceId: undefined })
              else update({ deviceId: v })
            }}
          >
            <option value="environment">Traseira</option>
            <option value="user">Frontal</option>
            {cameras.length > 2 &&
              cameras.map((c, i) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || `Câmera ${i + 1}`}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Resolução">
          <select
            className={selectClass}
            value={opts.height}
            onChange={(e) => update({ height: Number(e.target.value) as CaptureOptions['height'] })}
          >
            <option value={480}>480p (economia)</option>
            <option value={720}>720p (padrão)</option>
            <option value={1080}>1080p</option>
          </select>
        </Field>
        <Field label="Quadros por segundo">
          <select
            className={selectClass}
            value={opts.fps}
            onChange={(e) => update({ fps: Number(e.target.value) as CaptureOptions['fps'] })}
          >
            <option value={15}>15 fps (padrão)</option>
            <option value={20}>20 fps</option>
            <option value={30}>30 fps</option>
          </select>
        </Field>
        <Field label="Microfone">
          <select
            className={selectClass}
            value={opts.audio ? 'on' : 'off'}
            onChange={(e) => update({ audio: e.target.value === 'on' })}
          >
            <option value="on">Ligado</option>
            <option value="off">Desligado</option>
          </select>
        </Field>
      </section>

      <section className="rounded-2xl bg-white/5 p-4">
        <div className="mb-1 text-xs text-gray-400">Código da sala</div>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex-1 font-mono text-lg tracking-wider">{formatRoom(room)}</span>
          <button
            disabled={live}
            onClick={() => setRoom(newTransmitterRoom())}
            className="rounded-lg p-2 text-gray-400 hover:bg-white/10 disabled:opacity-30"
            aria-label="Gerar nova sala"
            title="Gerar nova sala (quem tinha o link antigo perde acesso)"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <Button variant="ghost" className="w-full" onClick={() => void share()}>
          <Share2 className="h-4 w-4" /> {copied ? 'Link copiado!' : 'Enviar link para o celular que vai assistir'}
        </Button>
      </section>

      {live && viewers.length > 0 && (
        <section className="rounded-2xl bg-white/5 p-4 text-xs text-gray-300">
          <div className="mb-2 text-gray-400">Visualizadores</div>
          <ul className="flex flex-col gap-1">
            {viewers.map((v) => (
              <li key={v.id} className="flex justify-between gap-2">
                <span className="font-mono">{v.id.slice(0, 4)}</span>
                <span className="text-right">{v.state === 'connected' ? statsText(v.stats) || 'conectado' : v.state}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-3">
        {live ? (
          <>
            <Button variant="ghost" className="flex-1" onClick={() => setDim(true)}>
              <Moon className="h-4 w-4" /> Escurecer tela
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => setLive(false)}>
              <Square className="h-4 w-4" /> Parar
            </Button>
          </>
        ) : (
          <Button className="flex-1" disabled={!stream} onClick={() => setLive(true)}>
            <Radio className="h-4 w-4" /> Iniciar transmissão
          </Button>
        )}
      </div>

      {live && !awake.current.supported && (
        <p className="text-xs text-amber-300">
          Este navegador não consegue manter a tela acesa sozinho. Nas configurações do Android, aumente o tempo de
          bloqueio da tela.
        </p>
      )}

      {dim && (
        <button
          onClick={() => setDim(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black pb-10 text-xs text-white/20"
        >
          Transmitindo · {connected.length} assistindo · toque para voltar
        </button>
      )}
    </main>
  )
}

function cameraError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError') return 'Permissão da câmera/microfone negada. Libere nas configurações do site no navegador.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Câmera não encontrada com essas opções. Tente outra câmera ou resolução.'
  if (name === 'NotReadableError') return 'A câmera está em uso por outro app. Feche-o e tente de novo.'
  return e instanceof Error ? e.message : 'Não foi possível abrir a câmera.'
}
