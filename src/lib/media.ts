export type Facing = 'environment' | 'user'

export interface CaptureOptions {
  facing: Facing
  /** quando o celular tem mais de uma câmera traseira, dá para escolher uma específica */
  deviceId?: string
  height: 480 | 720 | 1080
  fps: 15 | 20 | 30
  audio: boolean
}

export const DEFAULT_CAPTURE: CaptureOptions = { facing: 'environment', height: 720, fps: 15, audio: true }

export async function openCamera(o: CaptureOptions): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador não dá acesso à câmera. Use o Chrome atualizado e abra o site por https.')
  }
  const video: MediaTrackConstraints = {
    height: { ideal: o.height },
    width: { ideal: Math.round((o.height * 16) / 9) },
    frameRate: { ideal: o.fps, max: o.fps },
    ...(o.deviceId ? { deviceId: { exact: o.deviceId } } : { facingMode: { ideal: o.facing } }),
  }
  // Sem cancelamento de eco/ruído: queremos o som real do ambiente (e o choro) sem filtros.
  const audio: MediaTrackConstraints | false = o.audio
    ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    : false
  return navigator.mediaDevices.getUserMedia({ video, audio })
}

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const all = await navigator.mediaDevices.enumerateDevices()
  return all.filter((d) => d.kind === 'videoinput')
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop())
}
