import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary border-transparent hover:bg-primary-active',
  secondary: 'bg-canvas text-ink border-hairline hover:border-border-strong',
  danger: 'bg-canvas text-coral border-hairline hover:border-coral',
  ghost: 'bg-transparent text-ink border-transparent hover:bg-surface-strong',
};

const SIZE: Record<Size, string> = {
  md: 'px-lg py-md text-button rounded-lg',
  sm: 'px-sm py-xs text-ui-base rounded-md',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-xs whitespace-nowrap border font-medium leading-tight
        transition-colors disabled:opacity-45 disabled:cursor-not-allowed
        ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
