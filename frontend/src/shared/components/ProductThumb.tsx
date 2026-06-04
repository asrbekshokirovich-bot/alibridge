import { useState } from 'react';

/**
 * Mahsulot rasmi thumbnail. Rasm yo'q yoki yuklanmasa — 📦 placeholder.
 * URL odatda nisbiy `/media/...` — nginx MinIO proxy orqali beriladi.
 */
export function ProductThumb({
  src,
  size = 'h-12 w-12',
  className = '',
}: {
  src?: string | null;
  size?: string;
  className?: string;
}) {
  const [err, setErr] = useState(false);

  if (!src || err) {
    return (
      <div
        className={`flex ${size} flex-shrink-0 items-center justify-center rounded-2xl bg-tg-secondary-bg text-xl ${className}`}
      >
        📦
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setErr(true)}
      className={`${size} flex-shrink-0 rounded-2xl object-cover ${className}`}
    />
  );
}
