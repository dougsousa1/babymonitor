import { useState } from 'react'
import { Baby, Smartphone, Eye } from 'lucide-react'
import { Button } from '../components/ui'
import { lastViewerRoom, rememberViewerRoom } from '../lib/room'
import { normalizeRoom } from '../lib/ids'

export default function Home() {
  const [code, setCode] = useState(lastViewerRoom)
  const room = normalizeRoom(code)

  function watch() {
    if (room.length < 6) return
    rememberViewerRoom(room)
    location.hash = `#/ver/${room}`
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-3">
        <Baby className="h-8 w-8 text-indigo-300" />
        <div>
          <h1 className="text-xl font-semibold">Babycam</h1>
          <p className="text-xs text-gray-400">Retransmite o baby monitor para o seu celular</p>
        </div>
      </header>

      <section className="rounded-2xl bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2 font-medium">
          <Eye className="h-5 w-5 text-indigo-300" /> Assistir
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Abra o link enviado pelo transmissor, ou digite o código da sala.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            watch()
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="código da sala"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 font-mono text-sm tracking-wider outline-none focus:border-indigo-400"
          />
          <Button type="submit" disabled={room.length < 6}>
            Assistir
          </Button>
        </form>
      </section>

      <section className="rounded-2xl bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2 font-medium">
          <Smartphone className="h-5 w-5 text-indigo-300" /> Transmitir
        </div>
        <p className="mb-3 text-xs text-gray-400">
          Use no celular velho, preso no suporte apontado para a tela do monitor (ou para o berço).
        </p>
        <Button variant="ghost" className="w-full" onClick={() => (location.hash = '#/tx')}>
          Abrir modo transmissor
        </Button>
      </section>

      <p className="mt-auto text-center text-[11px] text-gray-500">
        Etapa 1 · prova de conceito. O vídeo vai direto de um celular para o outro (WebRTC, criptografado).
      </p>
    </main>
  )
}
