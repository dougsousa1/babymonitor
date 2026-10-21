import { normalizeRoom, randomId } from './ids'

const TX_KEY = 'babycam.salaTransmissor'
const VIEW_KEY = 'babycam.ultimaSala'

function get(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function put(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // modo anônimo: só não lembra
  }
}

/** Sala do transmissor: gerada uma vez e lembrada neste aparelho. */
export function transmitterRoom(): string {
  let room = get(TX_KEY)
  if (!room) {
    room = randomId(12)
    put(TX_KEY, room)
  }
  return room
}

export function newTransmitterRoom(): string {
  const room = randomId(12)
  put(TX_KEY, room)
  return room
}

export function lastViewerRoom(): string {
  return get(VIEW_KEY) ?? ''
}

export function rememberViewerRoom(room: string) {
  put(VIEW_KEY, normalizeRoom(room))
}

export function viewerLink(room: string): string {
  return `${location.origin}${location.pathname}#/ver/${room}`
}
