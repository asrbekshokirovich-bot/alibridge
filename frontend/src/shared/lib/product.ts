// Yuk turi yordamchilari — 3 tur: donali (piece), kiloli (boxed), tekstil (textile).
// Eski 'weight' turi tekstilga teng deb qaraladi.
import type { ProductType } from '@/shared/types'

export type ProductGroup = 'piece' | 'boxed' | 'textile'

// Turning normallashtirilgan guruhi
export function productGroup(t: ProductType): ProductGroup {
  if (t === 'piece') return 'piece'
  if (t === 'boxed') return 'boxed'
  return 'textile' // textile | weight
}

// Donali (dona bo'yicha) — narx va miqdor donaga
export function isPiece(t: ProductType): boolean {
  return t === 'piece'
}

// Narx/miqdor kg bo'yichami (kiloli yoki tekstil)
export function isByWeight(t: ProductType): boolean {
  return !isPiece(t)
}

// Birlik so'zi: 'dona' yoki 'kg'
export function unitWord(t: ProductType): 'dona' | 'kg' {
  return isPiece(t) ? 'dona' : 'kg'
}

// Emoji
const EMOJI: Record<ProductGroup, string> = { piece: '📦', boxed: '🗳️', textile: '🧵' }
export function typeEmoji(t: ProductType): string {
  return EMOJI[productGroup(t)]
}

// Qisqa nom
const LABEL: Record<ProductGroup, string> = { piece: 'Donali', boxed: 'Kiloli', textile: 'Tekstil' }
export function typeLabel(t: ProductType): string {
  return LABEL[productGroup(t)]
}

// Barkod PDF yorlig'i linki (auth shart emas) — chop etish uchun
// printDate berilsa, PDF'da o'sha sana ko'rsatiladi (bosilgan sana)
export function labelUrl(barcode: string, printDate?: string): string {
  const base = import.meta.env.VITE_API_URL ?? '/api/v1'
  const url = `${base}/labels/${barcode}.pdf`
  return printDate ? `${url}?print_date=${printDate}` : url
}
