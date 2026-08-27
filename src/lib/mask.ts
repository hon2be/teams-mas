import {
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  SLOT_MINUTES,
  SLOTS_PER_DAY,
} from './constants.ts'

export const emptyMask = (): string => '0'.repeat(SLOTS_PER_DAY)

export const parseMask = (mask: string): number[] => {
  const bits = mask.padEnd(SLOTS_PER_DAY, '0').slice(0, SLOTS_PER_DAY)
  return [...bits].map((bit) => (bit === '1' ? 1 : 0))
}

export const serializeMask = (bits: number[]): string =>
  bits
    .slice(0, SLOTS_PER_DAY)
    .map((bit) => (bit ? '1' : '0'))
    .join('')
    .padEnd(SLOTS_PER_DAY, '0')

export const slotToMinutes = (slot: number): number => DAY_START_MINUTES + slot * SLOT_MINUTES

export const minutesToLabel = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export const slotToLabel = (slot: number): string => minutesToLabel(slotToMinutes(slot))

export const windowEndLabel = (startSlot: number, durationMinutes: number): string =>
  minutesToLabel(slotToMinutes(startSlot) + durationMinutes)

export const hourLabels = (): number[] => {
  const hours: number[] = []
  for (let minutes = DAY_START_MINUTES; minutes < DAY_END_MINUTES; minutes += 60) {
    hours.push(minutes / 60)
  }
  return hours
}

export const findBlock = (bits: number[], index: number): { start: number; end: number } | null => {
  if (!bits[index]) {
    return null
  }

  let start = index
  let end = index + 1
  while (start > 0 && bits[start - 1]) {
    start -= 1
  }
  while (end < bits.length && bits[end]) {
    end += 1
  }
  return { start, end }
}

export const paintRange = (bits: number[], from: number, to: number, value: 0 | 1): number[] => {
  const next = [...bits]
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  for (let index = start; index <= end; index += 1) {
    next[index] = value
  }
  return next
}

export const moveBlock = (
  bits: number[],
  blockStart: number,
  blockEnd: number,
  targetStart: number,
): number[] => {
  const length = blockEnd - blockStart
  const clampedStart = Math.max(0, Math.min(SLOTS_PER_DAY - length, targetStart))
  const next = [...bits]
  for (let index = blockStart; index < blockEnd; index += 1) {
    next[index] = 0
  }
  for (let offset = 0; offset < length; offset += 1) {
    next[clampedStart + offset] = 1
  }
  return next
}
