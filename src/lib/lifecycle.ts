import { ARCHIVE_AFTER_DAYS, DELETE_AFTER_DAYS } from './constants.ts'
import { daysBetween, todayIso } from './dates.ts'
import { MeetingStatus, type Meeting } from '../types/models.ts'

const effectiveMeetingDate = (meeting: Meeting): string =>
  meeting.meetingDate ?? meeting.proposedDate

export const nextStatus = (meeting: Meeting, today = todayIso()): MeetingStatus => {
  if (meeting.status === MeetingStatus.DELETED) {
    return MeetingStatus.DELETED
  }

  const meetingDate = effectiveMeetingDate(meeting)
  const age = daysBetween(meetingDate, today)

  if (age >= DELETE_AFTER_DAYS) {
    return MeetingStatus.DELETED
  }
  if (age >= ARCHIVE_AFTER_DAYS) {
    return MeetingStatus.ARCHIVED
  }
  if (meetingDate < today) {
    return MeetingStatus.COMPLETED
  }
  return MeetingStatus.ACTIVE
}

export const applyDailyCleanup = (meetings: Meeting[], today = todayIso()): Meeting[] =>
  meetings.map((meeting) => {
    const status = nextStatus(meeting, today)
    return status === meeting.status ? meeting : { ...meeting, status }
  })
