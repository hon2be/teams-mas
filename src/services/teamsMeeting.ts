import { isAuthConfigured, ONLINE_MEETINGS_SCOPES } from '../lib/config.ts'
import type { Meeting, User } from '../types/models.ts'
import { graph } from './graphClient.ts'

/** 'HH:MM' 라벨을 그 날짜의 로컬 시각 ISO 문자열로 바꾼다. */
const toIsoDateTime = (isoDate: string, label: string): string => {
  const [hours, minutes] = label.split(':').map(Number)
  const date = new Date(`${isoDate}T00:00:00`)
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

const mockJoinUrl = (meeting: Meeting, startLabel: string, endLabel: string, count: number): string => {
  const token = meeting.id.replaceAll('-', '').slice(0, 12)
  return `https://teams.microsoft.com/l/meetup-join/mas/${token}?subject=${encodeURIComponent(meeting.title)}&start=${meeting.proposedDate}T${startLabel}&end=${endLabel}&attendees=${count}`
}

/**
 * FR-008 Teams Meeting 생성.
 * Entra 설정이 없으면 데모용 목 URL 을 만든다.
 */
export const createTeamsMeeting = async (
  meeting: Meeting,
  startLabel: string,
  endLabel: string,
  attendees: User[],
): Promise<{ joinUrl: string }> => {
  if (!isAuthConfigured()) {
    await new Promise((resolve) => setTimeout(resolve, 350))
    return { joinUrl: mockJoinUrl(meeting, startLabel, endLabel, attendees.length) }
  }

  const created = await graph<{ joinWebUrl?: string; joinUrl?: string }>('/me/onlineMeetings', {
    method: 'POST',
    scopes: ONLINE_MEETINGS_SCOPES,
    body: {
      subject: meeting.title,
      startDateTime: toIsoDateTime(meeting.proposedDate, startLabel),
      endDateTime: toIsoDateTime(meeting.proposedDate, endLabel),
      participants: {
        attendees: attendees
          .filter((user) => user.email)
          .map((user) => ({
            upn: user.email,
            role: 'attendee',
          })),
      },
    },
  })

  const joinUrl = created.joinWebUrl ?? created.joinUrl
  if (!joinUrl) {
    throw new Error('Graph 가 참가 URL 을 반환하지 않았습니다.')
  }
  return { joinUrl }
}
