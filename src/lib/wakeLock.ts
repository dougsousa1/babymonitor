/** Mantém a tela acesa enquanto ativo. O navegador solta o lock quando a aba some; pedimos de novo ao voltar. */
export class KeepAwake {
  private lock: WakeLockSentinel | null = null
  private active = false

  get supported() {
    return 'wakeLock' in navigator
  }

  async enable() {
    this.active = true
    document.addEventListener('visibilitychange', this.onVisibility)
    await this.request()
  }

  disable() {
    this.active = false
    document.removeEventListener('visibilitychange', this.onVisibility)
    void this.lock?.release().catch(() => {})
    this.lock = null
  }

  private onVisibility = () => {
    if (this.active && document.visibilityState === 'visible') void this.request()
  }

  private async request() {
    if (!this.supported || this.lock) return
    try {
      this.lock = await navigator.wakeLock.request('screen')
      this.lock.addEventListener('release', () => {
        this.lock = null
      })
    } catch {
      // Negado (ex.: economia de bateria). Seguimos sem.
    }
  }
}
