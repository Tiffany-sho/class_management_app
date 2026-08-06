import { formatMonthJa } from '@/lib/date';

interface Props {
  value: string;
  onChange: (key: string) => void;
  /** 動かせる範囲。外に出るボタンは押せなくする（押せるのに何も起きないのを避ける） */
  min?: string;
  max?: string;
  className?: string;
}

export function MonthNav({ value, onChange, min, max, className = '' }: Props) {
  const shift = (d: number) => {
    const [y, m] = value.split('-').map(Number);
    const total = (y ?? 0) * 12 + ((m ?? 1) - 1) + d;
    const next = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
    onChange(next);
  };
  const prevDisabled = Boolean(min && value <= min);
  const nextDisabled = Boolean(max && value >= max);

  return (
    <div className={`flex items-center gap-xs ${className}`}>
      <button
        type="button"
        onClick={() => shift(-1)}
        disabled={prevDisabled}
        aria-label="前の月"
        className="grid h-8 w-8 place-items-center rounded-pill border border-hairline bg-canvas
          text-ink hover:border-border-strong disabled:opacity-40 disabled:hover:border-hairline"
      >
        ‹
      </button>
      <div className="min-w-[120px] text-center text-[15px] font-medium text-ink tnum">
        {formatMonthJa(value)}
      </div>
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={nextDisabled}
        aria-label="次の月"
        className="grid h-8 w-8 place-items-center rounded-pill border border-hairline bg-canvas
          text-ink hover:border-border-strong disabled:opacity-40 disabled:hover:border-hairline"
      >
        ›
      </button>
    </div>
  );
}
