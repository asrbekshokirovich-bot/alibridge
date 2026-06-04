import { HTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={twMerge(
        'rounded-4xl bg-tg-sectionBg p-4 shadow-card ring-1 ring-white/[0.06]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
