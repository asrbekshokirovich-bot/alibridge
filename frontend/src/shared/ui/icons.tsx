interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' })
const stroke = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const IconBox = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M21 8l-9-5-9 5m18 0v8l-9 5m9-13l-9 5m0 8l-9-5V8m9 13V13m-9-5l9 5" {...stroke} />
  </svg>
)

export const IconBag = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18M16 10a4 4 0 01-8 0" {...stroke} />
  </svg>
)

export const IconTruck = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" {...stroke} />
  </svg>
)

export const IconHome = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M9 22V12h6v10" {...stroke} />
  </svg>
)

export const IconScan = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 12h10" {...stroke} />
  </svg>
)

export const IconHandshake = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M11 17l2 2a1 1 0 001.4 0l3-3M6 9l3-3 4 4M3 11l4-4 3 3M14 7l3 3 4-4M2 13l4 4" {...stroke} />
  </svg>
)

export const IconUser = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" {...stroke} />
  </svg>
)

export const IconUsers = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" {...stroke} />
  </svg>
)

export const IconMoney = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" {...stroke} />
  </svg>
)

export const IconAlert = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" {...stroke} />
  </svg>
)

export const IconCheck = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M20 6L9 17l-5-5" {...stroke} />
  </svg>
)

export const IconPlane = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M17.8 19.2L16 11l3.5-3.5a2.12 2.12 0 00-3-3L13 8 4.8 6.2a1 1 0 00-.9 1.7l4.6 3.4-2 2.5-2.4-.3a1 1 0 00-.8 1.6l2 2 2 2a1 1 0 001.6-.8l-.3-2.4 2.5-2 3.4 4.6a1 1 0 001.7-.9z" {...stroke} />
  </svg>
)

export const IconList = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...stroke} />
  </svg>
)

export const IconPackagePlus = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M16 16l-4 4-4-4M12 3v9M3 10h4l2 3M21 10h-4l-2 3" {...stroke} />
  </svg>
)

export const IconPhone = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z" {...stroke} />
  </svg>
)

export const IconCard = ({ size = 24, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2" y="5" width="20" height="14" rx="2" {...stroke} />
    <path d="M2 10h20" {...stroke} />
  </svg>
)
