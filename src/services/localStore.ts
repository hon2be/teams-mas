import type { Availability, Meeting, Participant } from '../types/models.ts'
import { applyDailyCleanup } from '../lib/lifecycle.ts'
import { MeetingStatus } from '../types/models.ts'
import type { Store } from './store.ts'

const KEYS = {
  meetings: 'mas.meetings',
  participants: 'mas.participants',
  availabilities: 'mas.availabilities',
  webhooks: 'mas.webhooks',
} as const

const readJson = <T>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key)
  if (!raw) {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown): void => {
  localStorage.setItem(key, JSON.stringify(value))
}

const webhookKey = (scopeId: string | null): string => scopeId ?? '__personal__'

const aliveMeetings = (): Meeting[] => {
  const cleaned = applyDailyCleanup(readJson<Meeting[]>(KEYS.meetings, []))
  writeJson(KEYS.meetings, cleaned)
  return cleaned.filter((meeting) => meeting.status !== MeetingStatus.DELETED)
}

/**
 * 브라우저 localStorage 백엔드.
 *
 * 주의: 데이터가 브라우저에 갇히므로 참석자끼리 공유되지 않는다.
 * 데모/개발 전용이고, 실사용은 SharePoint 백엔드를 쓴다.
 */
export const localStore: Store = {
  kind: 'local',

  async listMeetings(scopeId) {
    const alive = aliveMeetings()
    return scopeId === null ? alive : alive.filter((meeting) => meeting.scopeId === scopeId)
  },

  async getMeeting(id) {
    return aliveMeetings().find((meeting) => meeting.id === id)
  },

  async upsertMeeting(meeting) {
    const meetings = readJson<Meeting[]>(KEYS.meetings, [])
    const next = meetings.some((item) => item.id === meeting.id)
      ? meetings.map((item) => (item.id === meeting.id ? meeting : item))
      : [...meetings, meeting]
    writeJson(KEYS.meetings, next)
  },

  async listParticipants(meetingId) {
    return readJson<Participant[]>(KEYS.participants, []).filter(
      (item) => item.meetingId === meetingId,
    )
  },

  async replaceParticipants(meetingId, participants) {
    const others = readJson<Participant[]>(KEYS.participants, []).filter(
      (item) => item.meetingId !== meetingId,
    )
    writeJson(KEYS.participants, [...others, ...participants])
  },

  async listAvailabilities(meetingId) {
    return readJson<Availability[]>(KEYS.availabilities, []).filter(
      (item) => item.meetingId === meetingId,
    )
  },

  async upsertAvailability(availability) {
    const items = readJson<Availability[]>(KEYS.availabilities, [])
    const index = items.findIndex(
      (item) => item.meetingId === availability.meetingId && item.userId === availability.userId,
    )
    if (index >= 0) {
      items[index] = availability
    } else {
      items.push(availability)
    }
    writeJson(KEYS.availabilities, items)
  },

  async pruneAvailabilities(meetingId, keepUserIds) {
    const keep = new Set(keepUserIds)
    writeJson(
      KEYS.availabilities,
      readJson<Availability[]>(KEYS.availabilities, []).filter(
        (item) => item.meetingId !== meetingId || keep.has(item.userId),
      ),
    )
  },

  async runCleanup() {
    const meetings = applyDailyCleanup(readJson<Meeting[]>(KEYS.meetings, []))
    const deletedIds = new Set(
      meetings
        .filter((meeting) => meeting.status === MeetingStatus.DELETED)
        .map((meeting) => meeting.id),
    )
    writeJson(KEYS.meetings, meetings)
    writeJson(
      KEYS.participants,
      readJson<Participant[]>(KEYS.participants, []).filter(
        (item) => !deletedIds.has(item.meetingId),
      ),
    )
    writeJson(
      KEYS.availabilities,
      readJson<Availability[]>(KEYS.availabilities, []).filter(
        (item) => !deletedIds.has(item.meetingId),
      ),
    )
  },

  async getWebhookUrl(scopeId) {
    return readJson<Record<string, string>>(KEYS.webhooks, {})[webhookKey(scopeId)] ?? ''
  },

  async setWebhookUrl(scopeId, url) {
    const map = readJson<Record<string, string>>(KEYS.webhooks, {})
    const trimmed = url.trim()
    if (trimmed) {
      map[webhookKey(scopeId)] = trimmed
    } else {
      delete map[webhookKey(scopeId)]
    }
    writeJson(KEYS.webhooks, map)
  },
}
