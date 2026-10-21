const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // sem letras/números ambíguos

export function randomId(len = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

/** Normaliza o código de sala digitado (minúsculas, sem espaços/traços). */
export function normalizeRoom(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function formatRoom(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-')
}
