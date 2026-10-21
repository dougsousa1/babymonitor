import { Peer, StatsReader, type LinkStats } from './rtc'
import { Signaling, type SignalMessage, type SignalStatus } from './signaling'
import { randomId } from './ids'

export interface ViewerInfo {
  id: string
  state: RTCPeerConnectionState
  stats?: LinkStats
}

interface ViewerConn {
  peer: Peer
  stats: StatsReader
  info: ViewerInfo
  lostTimer?: number
}

/** Teto de envio de vídeo por visualizador (bits/s), por altura da imagem. Economiza dados no 4G. */
export function maxBitrateFor(height: number): number {
  if (height <= 480) return 500_000
  if (height <= 720) return 1_000_000
  return 2_000_000
}

/**
 * Lado do celular velho: aceita vários visualizadores, uma RTCPeerConnection para cada.
 * O transmissor sempre faz a oferta; o visualizador responde.
 */
export class TransmitterSession {
  readonly selfId = randomId(8)
  private sig: Signaling
  private viewers = new Map<string, ViewerConn>()
  private stream: MediaStream
  private statsTimer?: number
  private sigStatus: SignalStatus = 'connecting'

  constructor(
    room: string,
    stream: MediaStream,
    private onChange: (viewers: ViewerInfo[], sig: SignalStatus) => void,
  ) {
    this.stream = stream
    this.sig = new Signaling(room, this.selfId, 'transmitter', (m) => void this.handle(m), (s) => {
      this.sigStatus = s
      if (s === 'online') this.sig.send('tx-online') // visualizadores que já esperavam pedem conexão
      this.emit()
    })
  }

  start() {
    this.sig.start()
    this.statsTimer = window.setInterval(() => void this.pollStats(), 2000)
  }

  stop() {
    window.clearInterval(this.statsTimer)
    for (const id of [...this.viewers.keys()]) this.drop(id)
    this.sig.stop()
  }

  /** Troca câmera/resolução sem derrubar quem está assistindo. */
  async setStream(stream: MediaStream) {
    this.stream = stream
    const video = stream.getVideoTracks()[0]
    const audio = stream.getAudioTracks()[0]
    for (const { peer } of this.viewers.values()) {
      for (const t of peer.pc.getTransceivers()) {
        const kind = t.receiver.track.kind
        const track = kind === 'video' ? video : audio
        if (track && t.sender) await t.sender.replaceTrack(track).catch(() => {})
        if (kind === 'video' && video) void this.applyBitrate(t.sender, video)
      }
    }
  }

  private async handle(msg: SignalMessage) {
    if (msg.role !== 'viewer') return
    switch (msg.kind) {
      case 'hello':
        await this.connectViewer(msg.from)
        break
      case 'answer':
        await this.viewers.get(msg.from)?.peer.setRemote(msg.data as RTCSessionDescriptionInit).catch(() => this.drop(msg.from))
        break
      case 'ice':
        await this.viewers.get(msg.from)?.peer.addIce(msg.data as RTCIceCandidateInit)
        break
      case 'bye':
        this.drop(msg.from)
        break
    }
  }

  private async connectViewer(id: string) {
    this.drop(id)
    const peer = new Peer((c) => this.sig.send('ice', c, id))
    const conn: ViewerConn = { peer, stats: new StatsReader(peer.pc, 'outbound'), info: { id, state: 'new' } }
    this.viewers.set(id, conn)

    for (const track of this.stream.getTracks()) {
      const t = peer.pc.addTransceiver(track, { direction: 'sendonly', streams: [this.stream] })
      if (track.kind === 'video') void this.applyBitrate(t.sender, track)
    }

    peer.pc.onconnectionstatechange = () => {
      const state = peer.pc.connectionState
      conn.info = { ...conn.info, state }
      window.clearTimeout(conn.lostTimer)
      if (state === 'failed' || state === 'closed') this.drop(id)
      // Sem notícia por 20 s: libera. Se o visualizador voltar, ele manda novo "hello".
      else if (state === 'disconnected') conn.lostTimer = window.setTimeout(() => this.drop(id), 20_000)
      this.emit()
    }

    const offer = await peer.pc.createOffer()
    await peer.pc.setLocalDescription(offer)
    this.sig.send('offer', peer.pc.localDescription?.toJSON(), id)
    this.emit()
  }

  private async applyBitrate(sender: RTCRtpSender, track: MediaStreamTrack) {
    try {
      const params = sender.getParameters()
      if (!params.encodings?.length) params.encodings = [{}]
      const h = track.getSettings().height ?? 720
      params.encodings[0].maxBitrate = maxBitrateFor(h)
      params.degradationPreference = 'balanced'
      await sender.setParameters(params)
    } catch {
      // Alguns navegadores só aceitam depois da negociação; não é crítico.
    }
  }

  private drop(id: string) {
    const conn = this.viewers.get(id)
    if (!conn) return
    window.clearTimeout(conn.lostTimer)
    conn.peer.close()
    this.viewers.delete(id)
    this.emit()
  }

  private async pollStats() {
    for (const conn of this.viewers.values()) {
      if (conn.info.state !== 'connected') continue
      conn.info = { ...conn.info, stats: await conn.stats.read().catch(() => conn.info.stats) }
    }
    this.emit()
  }

  private emit() {
    this.onChange([...this.viewers.values()].map((v) => v.info), this.sigStatus)
  }
}
