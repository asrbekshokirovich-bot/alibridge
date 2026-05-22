import { HTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={twMerge('rounded-2xl bg-tg-sectionBg p-4 shadow-sm', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
