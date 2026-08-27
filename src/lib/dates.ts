import { COLLECTION_MONTHS } from './constants.ts'

export const addMonths = (isoDate: string, months: number): string => {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setMonth(date.getMonth() + months)
  return toIsoDate(date)
}

export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

export const toIsoDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const todayIso = (): string => toIsoDate(new Date())

export const collectionRange = (today = todayIso()) => ({
  min: addMonths(today, -COLLECTION_MONTHS),
  max: addMonths(today, COLLECTION_MONTHS),
})

export const isWithinCollectionRange = (isoDate: string, today = todayIso()): boolean => {
  const { min, max } = collectionRange(today)
  return isoDate >= min && isoDate <= max
}

export const formatKoreanDate = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00`)
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

export const daysBetween = (fromIso: string, toIso: string): number => {
  const from = new Date(`${fromIso}T00:00:00`).getTime()
  const to = new Date(`${toIso}T00:00:00`).getTime()
  return Math.floor((to - from) / 86_400_000)
}
