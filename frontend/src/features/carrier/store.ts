import { create } from 'zustand'
import type { Ticket } from '@/shared/types'

interface CarrierStore {
  ticket: Ticket | null
  setTicket: (t: Ticket) => void
  clearTicket: () => void
}

// Bilet localStorage'dan xavfsiz o'qiladi (yangilanguncha turadi)
function loadTicket(): Ticket | null {
  try {
    const raw = localStorage.getItem('carrier_ticket')
    return raw ? (JSON.parse(raw) as Ticket) : null
  } catch {
    localStorage.removeItem('carrier_ticket')
    return null
  }
}

export const useCarrierStore = create<CarrierStore>((set) => ({
  ticket: loadTicket(),
  setTicket: (t) => {
    localStorage.setItem('carrier_ticket', JSON.stringify(t))
    set({ ticket: t })
  },
  clearTicket: () => {
    localStorage.removeItem('carrier_ticket')
    set({ ticket: null })
  },
}))
