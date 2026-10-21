import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition active:scale-[.98] disabled:opacity-50',
        variant === 'primary' && 'bg-indigo-500 text-white hover:bg-indigo-400',
        variant === 'ghost' && 'bg-white/10 text-gray-100 hover:bg-white/15',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
        className,
      )}
    />
  )
}

export function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'off'; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur',
        tone === 'ok' && 'bg-emerald-500/20 text-emerald-200',
        tone === 'warn' && 'bg-amber-500/20 text-amber-200',
        tone === 'off' && 'bg-white/10 text-gray-300',
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          tone === 'ok' && 'bg-emerald-400',
          tone === 'warn' && 'animate-pulse bg-amber-400',
          tone === 'off' && 'bg-gray-400',
        )}
      />
      {children}
    </span>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-gray-400">
      {label}
      {children}
    </label>
  )
}

export const selectClass =
  'rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-400'
