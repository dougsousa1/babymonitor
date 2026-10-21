import { Peer, StatsReader, type LinkStats } from './rtc'
import { Signaling, type SignalMessage, type SignalStatus } from './signaling'
import { randomId } from './ids'

export type LinkPhase = 'aguardando' | 'conectando' | 'conectado' | 'reconectando'

export interface ViewerState {
  signaling: SignalStatus
  phase: LinkPhase
  stats?: LinkStats
}

const HELLO_EVERY_MS = 4000
const STUCK_AFTER_MS = 15_000
const DISCONNECT_GRACE_MS = 5000

/** Lado do celular dos pais: pede conexão, responde à oferta do transmissor e reconecta sozinho. */
export class ViewerSession {
  readonly selfId = randomId(8)
  private sig: Signaling
  private peer: Peer | null = null
  private peerSince = 0
  private stats: StatsReader | null = null
  private transmitterId: string | null = null
  private helloTimer?: number
  private statsTimer?: number
  private lostTimer?: number
  private state: ViewerState = { signaling: 'connecting', phase: 'aguardando' }

  constructor(
    room: string,
    private onStream: (stream: MediaStream | null) => void,
    private onState: (state: ViewerState) => void,
  ) {
    this.sig = new Signaling(room, this.selfId, 'viewer', (m) => void this.handle(m), (s) => {
      this.set({ signaling: s })
      if (s === 'online') this.hello()
    })
  }

  start() {
    this.sig.start()
    // Enquanto não houver conexão, repete o pedido (o transmissor pode ligar depois).
    this.helloTimer = window.setInterval(() => {
      const stuck = this.peer && this.state.phase !== 'conectado' && Date.now() - this.peerSince > STUCK_AFTER_MS
      if (!this.peer || stuck) this.reset('reconectando')
      if (!this.peer) this.hello()
    }, HELLO_EVERY_MS)
    this.statsTimer = window.setInterval(() => void this.pollStats(), 2000)
  }

  stop() {
    window.clearInterval(this.helloTimer)
    window.clearInterval(this.statsTimer)
    this.reset('aguardando')
    this.sig.stop()
  }

  private hello() {
    if (this.state.signaling === 'online') this.sig.send('hello')
  }

  private async handle(msg: SignalMessage) {
    if (msg.role !== 'transmitter') return
    switch (msg.kind) {
      case 'tx-online':
        this.reset(this.peer ? 'reconectando' : 'aguardando')
        this.hello()
        break
      case 'offer':
        await this.accept(msg.from, msg.data as RTCSessionDescriptionInit)
        break
      case 'ice':
        if (msg.from === this.transmitterId) await this.peer?.addIce(msg.data as RTCIceCandidateInit)
        break
      case 'bye':
        if (msg.from === this.transmitterId) this.reset('aguardando')
        break
    }
  }

  private async accept(from: string, offer: RTCSessionDescriptionInit) {
    this.reset('conectando')
    this.transmitterId = from
    const peer = new Peer((c) => this.sig.send('ice', c, from))
    this.peer = peer
    this.peerSince = Date.now()
    this.stats = new StatsReader(peer.pc, 'inbound')
    const stream = new MediaStream()

    peer.pc.ontrack = (e) => {
      stream.addTrack(e.track)
      this.onStream(stream)
    }
    peer.pc.onconnectionstatechange = () => {
      if (this.peer !== peer) return
      const s = peer.pc.connectionState
      window.clearTimeout(this.lostTimer)
      if (s === 'connected') this.set({ phase: 'conectado' })
      else if (s === 'failed') this.retry()
      else if (s === 'disconnected') {
        this.set({ phase: 'reconectando' })
        this.lostTimer = window.setTimeout(() => this.retry(), DISCONNECT_GRACE_MS)
      }
    }

    try {
      await peer.setRemote(offer)
      const answer = await peer.pc.createAnswer()
      await peer.pc.setLocalDescription(answer)
      this.sig.send('answer', peer.pc.localDescription?.toJSON(), from)
    } catch {
      this.retry()
    }
  }

  private retry() {
    this.reset('reconectando')
    this.hello()
  }

  private reset(phase: LinkPhase) {
    window.clearTimeout(this.lostTimer)
    if (this.peer) {
      this.peer.close()
      this.peer = null
      this.stats = null
      this.onStream(null)
    }
    this.set({ phase, stats: undefined })
  }

  private async pollStats() {
    if (!this.stats || this.state.phase !== 'conectado') return
    const stats = await this.stats.read().catch(() => undefined)
    if (stats) this.set({ stats })
  }

  private set(patch: Partial<ViewerState>) {
    this.state = { ...this.state, ...patch }
    this.onState(this.state)
  }
}
