import { twMerge } from 'tailwind-merge';

export type TileColor = 'violet' | 'blue' | 'pink' | 'lime' | 'cyan' | 'amber';

const SCHEMES: Record<
  TileColor,
  { card: string; text: string; sub: string; iconBg: string; badge: string }
> = {
  violet: {
    card: 'bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow-violet',
    text: 'text-white',
    sub: 'text-white/70',
    iconBg: 'bg-white/20',
    badge: 'bg-white/25 text-white',
  },
  blue: {
    card: 'bg-gradient-to-br from-accent-blue to-blue-600 shadow-glow-blue',
    text: 'text-white',
    sub: 'text-white/70',
    iconBg: 'bg-white/20',
    badge: 'bg-white/25 text-white',
  },
  pink: {
    card: 'bg-gradient-to-br from-accent-pink to-pink-600 shadow-glow-pink',
    text: 'text-white',
    sub: 'text-white/70',
    iconBg: 'bg-white/20',
    badge: 'bg-white/25 text-white',
  },
  lime: {
    card: 'bg-accent-lime shadow-glow-lime',
    text: 'text-[#0a0a0f]',
    sub: 'text-[#0a0a0f]/60',
    iconBg: 'bg-black/10',
    badge: 'bg-black/15 text-[#0a0a0f]',
  },
  cyan: {
    card: 'bg-accent-cyan shadow-glow-cyan',
    text: 'text-[#0a0a0f]',
    sub: 'text-[#0a0a0f]/60',
    iconBg: 'bg-black/10',
    badge: 'bg-black/15 text-[#0a0a0f]',
  },
  amber: {
    card: 'bg-accent-amber shadow-glow-amber',
    text: 'text-[#0a0a0f]',
    sub: 'text-[#0a0a0f]/60',
    iconBg: 'bg-black/10',
    badge: 'bg-black/15 text-[#0a0a0f]',
  },
};

interface ActionTileProps {
  icon: string;
  label: string;
  color: TileColor;
  onClick: () => void;
  desc?: string;
  badge?: number | null;
  className?: string;
}

/** Rang-barang bento amal kartasi (iOS uslubidagi yorqin ranglar). */
export function ActionTile({
  icon,
  label,
  color,
  onClick,
  desc,
  badge,
  className,
}: ActionTileProps) {
  const s = SCHEMES[color];
  return (
    <button
      onClick={onClick}
      className={twMerge(
        'relative flex flex-col overflow-hidden rounded-4xl p-4 text-left transition-all active:scale-[0.96]',
        s.card,
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-2xl ${s.iconBg}`}>
          {icon}
        </span>
        {badge != null && badge > 0 && (
          <span className={`pill ${s.badge}`}>{badge}</span>
        )}
      </div>
      <p className={`mt-8 text-base font-extrabold leading-tight ${s.text}`}>{label}</p>
      {desc && <p className={`mt-0.5 text-xs leading-snug ${s.sub}`}>{desc}</p>}
    </button>
  );
}
