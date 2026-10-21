import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'transmitter' | 'viewer'

export type SignalKind = 'hello' | 'tx-online' | 'offer' | 'answer' | 'ice' | 'bye'

export interface SignalMessage {
  from: string
  role: Role
  to?: string
  kind: SignalKind
  data?: unknown
}

export type SignalStatus = 'connecting' | 'online' | 'offline'

/**
 * Canal de sinalização sobre o Supabase Realtime (broadcast).
 * Só trafega mensagens pequenas de negociação (SDP/ICE); nenhuma mídia passa por aqui.
 * O cliente Realtime reconecta sozinho; a cada novo SUBSCRIBED avisamos via onStatus('online').
 */
export class Signaling {
  private channel: RealtimeChannel | null = null
  private closed = false

  constructor(
    readonly room: string,
    readonly selfId: string,
    readonly role: Role,
    private onMessage: (msg: SignalMessage) => void,
    private onStatus: (status: SignalStatus) => void,
  ) {}

  start() {
    if (!supabase) throw new Error('Supabase não configurado')
    this.onStatus('connecting')
    this.channel = supabase
      .channel(`babycam:${this.room}`, { config: { broadcast: { self: false, ack: false } } })
      .on('broadcast', { event: 'sig' }, ({ payload }) => {
        const msg = payload as SignalMessage
        if (msg.from === this.selfId) return
        if (msg.to && msg.to !== this.selfId) return
        this.onMessage(msg)
      })
      .subscribe((status) => {
        if (this.closed) return
        if (status === 'SUBSCRIBED') this.onStatus('online')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') this.onStatus('offline')
      })
  }

  send(kind: SignalKind, data?: unknown, to?: string) {
    if (!this.channel) return
    const msg: SignalMessage = { from: this.selfId, role: this.role, kind, data, to }
    void this.channel.send({ type: 'broadcast', event: 'sig', payload: msg })
  }

  stop() {
    this.closed = true
    if (this.channel) {
      this.send('bye')
      void supabase?.removeChannel(this.channel)
      this.channel = null
    }
  }
}
