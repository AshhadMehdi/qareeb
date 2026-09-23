import type { ReactNode } from 'react';
import { STATUS_LABELS, statusTone } from '../lib/format';

export function StatusPill({ status, className = '' }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(
        status,
      )} ${className}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-cream-200/80 ${className}`} />;
}

export function EmptyState({
  title,
  body,
  action,
  compact = false,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? 'py-8' : 'py-14'}`}>
      <p className="text-base font-semibold text-ink-900">{title}</p>
      {body ? <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-500">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl border border-clay-100 bg-clay-100/60 px-3 py-2 text-sm font-medium text-clay-600">
      {children}
    </p>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-forest-800">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'forest' | 'wheat';
}) {
  const tones = {
    default: 'text-ink-900',
    forest: 'text-forest-700',
    wheat: 'text-wheat-500',
  } as const;
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className={`mt-2 text-xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/35 p-0 sm:items-center sm:p-6">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-cream-300 bg-cream-50 p-5 shadow-xl sm:rounded-3xl ${
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-bold text-forest-800">{title}</h3>
          <button type="button" onClick={onClose} className="btn btn-quiet px-3 py-1.5 text-xs">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  max = 50,
  size = 'default',
}: {
  value: number;
  onChange: (next: number) => void;
  max?: number;
  size?: 'default' | 'small';
}) {
  const button = size === 'small' ? 'h-7 w-7 text-sm' : 'h-9 w-9';
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-forest-200 bg-forest-50 px-1.5 py-1">
      <button
        type="button"
        aria-label="Decrease quantity"
        className={`grid place-items-center rounded-full bg-cream-50 font-bold text-forest-700 ${button}`}
        onClick={() => onChange(Math.max(0, value - 1))}
      >
        −
      </button>
      <span className="min-w-5 text-center text-sm font-bold tabular-nums text-forest-800">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        className={`grid place-items-center rounded-full bg-forest-600 font-bold text-cream-50 disabled:opacity-40 ${button}`}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function Stars({ rating, count }: { rating: number; count?: number }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-700">
      <span aria-hidden className="text-forest-500">
        ★
      </span>
      {rating.toFixed(1)}
      {count != null ? <span className="font-normal text-ink-500">({count})</span> : null}
      <span className="sr-only">{rounded} out of 5</span>
    </span>
  );
}

export function Tag({ children, tone = 'cream' }: { children: ReactNode; tone?: 'cream' | 'forest' | 'clay' | 'wheat' }) {
  const tones = {
    cream: 'border-cream-300 bg-cream-100 text-ink-700',
    forest: 'border-forest-100 bg-forest-50 text-forest-700',
    clay: 'border-clay-100 bg-clay-100 text-clay-600',
    wheat: 'border-wheat-100 bg-wheat-100 text-wheat-500',
  } as const;
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}
