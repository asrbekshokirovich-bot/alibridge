// Dev/test rejim — barcha cheklovlar yumshatiladi
export const IS_DEV = import.meta.env.VITE_USE_MOCK === 'true'

// Test uchun standart bilet (bilet kiritilmagan bo'lsa ishlatiladi)
export const DEFAULT_TICKET = {
  flight_number: 'TEST-001',
  flight_date: '2026-06-10',
  weight_limit: 30,
}
