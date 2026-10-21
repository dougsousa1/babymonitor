/** Servidores ICE. Etapa 1: só STUN público do Google (funciona na mesma rede e em boa parte dos 4G). TURN entra na etapa 3. */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

/** RTCPeerConnection + fila de candidatos ICE que chegam antes da descrição remota. */
export class Peer {
  readonly pc: RTCPeerConnection
  private pendingIce: RTCIceCandidateInit[] = []

  constructor(onLocalIce: (c: RTCIceCandidateInit) => void) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pc.onicecandidate = (e) => {
      if (e.candidate) onLocalIce(e.candidate.toJSON())
    }
  }

  async setRemote(desc: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(desc)
    const queued = this.pendingIce
    this.pendingIce = []
    for (const c of queued) await this.pc.addIceCandidate(c).catch(() => {})
  }

  async addIce(c: RTCIceCandidateInit) {
    if (this.pc.remoteDescription) await this.pc.addIceCandidate(c).catch(() => {})
    else this.pendingIce.push(c)
  }

  close() {
    this.pc.onicecandidate = null
    this.pc.ontrack = null
    this.pc.onconnectionstatechange = null
    this.pc.close()
  }
}

export type Route = 'local' | 'stun' | 'turn' | 'desconhecida'

export interface LinkStats {
  route: Route
  rttMs?: number
  /** kbps recebidos (visualizador) ou enviados (transmissor) */
  kbps?: number
  width?: number
  height?: number
  fps?: number
}

export const ROUTE_LABEL: Record<Route, string> = {
  local: 'P2P direto (mesma rede)',
  stun: 'P2P direto (internet)',
  turn: 'Via TURN (retransmitido)',
  desconhecida: '—',
}

/** Lê getStats periodicamente e calcula taxa de bits pela diferença entre leituras. */
export class StatsReader {
  private lastBytes = 0
  private lastTs = 0

  constructor(
    private pc: RTCPeerConnection,
    private direction: 'inbound' | 'outbound',
  ) {}

  async read(): Promise<LinkStats> {
    const report = await this.pc.getStats()
    let pair: RTCIceCandidatePairStats | undefined
    let bytes = 0
    let ts = 0
    const out: LinkStats = { route: 'desconhecida' }

    report.forEach((s) => {
      if (s.type === 'transport' && s.selectedCandidatePairId) {
        pair = report.get(s.selectedCandidatePairId) as RTCIceCandidatePairStats
      }
    })
    if (!pair) {
      report.forEach((s) => {
        if (s.type === 'candidate-pair' && s.state === 'succeeded' && (s.nominated || s.selected)) pair = s
      })
    }
    if (pair) {
      const local = report.get(pair.localCandidateId)
      const remote = report.get(pair.remoteCandidateId)
      const types = [local?.candidateType, remote?.candidateType]
      out.route = types.includes('relay') ? 'turn' : types.every((t) => t === 'host') ? 'local' : 'stun'
      if (pair.currentRoundTripTime != null) out.rttMs = Math.round(pair.currentRoundTripTime * 1000)
    }

    const rtpType = this.direction === 'inbound' ? 'inbound-rtp' : 'outbound-rtp'
    report.forEach((s) => {
      if (s.type !== rtpType) return
      bytes += (this.direction === 'inbound' ? s.bytesReceived : s.bytesSent) ?? 0
      ts = Math.max(ts, s.timestamp)
      if (s.kind === 'video') {
        out.width = s.frameWidth
        out.height = s.frameHeight
        out.fps = s.framesPerSecond != null ? Math.round(s.framesPerSecond) : undefined
      }
    })
    if (this.lastTs && ts > this.lastTs && bytes >= this.lastBytes) {
      out.kbps = Math.round(((bytes - this.lastBytes) * 8) / (ts - this.lastTs))
    }
    this.lastBytes = bytes
    this.lastTs = ts
    return out
  }
}
