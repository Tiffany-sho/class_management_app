import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

const BASE =
  'w-full rounded-md border border-hairline bg-canvas px-sm py-[10px] text-[14px] text-ink ' +
  'placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="mb-md block">
      <span className="mb-[6px] block text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-[6px] block text-[12px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${BASE} ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${BASE} resize-y ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${BASE} ${className}`} {...rest}>
      {children}
    </select>
  );
}

/** ラジオ相当のセグメント。選択肢が3つ以下のときに使う */
export function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={name} className="flex gap-[3px] rounded-md bg-surface-strong p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-sm px-sm py-[7px] text-[13px] transition-colors
            ${value === o.value ? 'bg-canvas font-medium text-ink shadow-card' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
