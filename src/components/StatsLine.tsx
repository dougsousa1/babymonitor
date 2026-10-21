import { ROUTE_LABEL, type LinkStats } from '../lib/rtc'

export function statsText(s?: LinkStats): string {
  if (!s) return ''
  const parts = [ROUTE_LABEL[s.route]]
  if (s.rttMs != null) parts.push(`${s.rttMs} ms`)
  if (s.height) parts.push(`${s.height}p${s.fps ? ` ${s.fps} fps` : ''}`)
  if (s.kbps != null) parts.push(`${s.kbps} kbps`)
  return parts.join(' · ')
}
