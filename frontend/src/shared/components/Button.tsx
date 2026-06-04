import { ButtonHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={twMerge(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50',
        clsx({
          'bg-gradient-to-br from-brand-400 to-accent-blue text-white shadow-glow-violet hover:brightness-110':
            variant === 'primary',
          'bg-tg-secondaryBg text-tg-text ring-1 ring-white/10 hover:bg-tg-elevated':
            variant === 'secondary',
          'bg-red-500/90 text-white hover:bg-red-500': variant === 'destructive',
          'bg-transparent text-tg-text hover:bg-white/5': variant === 'ghost',

          'px-3.5 py-2 text-sm': size === 'sm',
          'px-5 py-3 text-base': size === 'md',
          'px-6 py-4 text-lg': size === 'lg',

          'w-full': fullWidth,
        }),
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </button>
  );
}
