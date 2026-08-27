export const SLOT_MINUTES = 10
export const DEFAULT_DURATION_MINUTES = 30
export const MIN_DURATION_MINUTES = 30
export const MAX_DURATION_MINUTES = 480
export const DAY_START_MINUTES = 9 * 60
export const DAY_END_MINUTES = 18 * 60
export const SLOTS_PER_DAY = (DAY_END_MINUTES - DAY_START_MINUTES) / SLOT_MINUTES
export const COLLECTION_MONTHS = 1
export const ARCHIVE_AFTER_DAYS = 60
export const DELETE_AFTER_DAYS = 90
export const TOP_RECOMMENDATIONS = 3

export const ROLE_WEIGHT = {
  Organizer: 1000,
  Required: 100,
  Optional: 10,
} as const
