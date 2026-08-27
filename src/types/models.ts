export const MeetingStatus = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const

export type MeetingStatus = (typeof MeetingStatus)[keyof typeof MeetingStatus]

export const ParticipantRole = {
  Organizer: 'Organizer',
  Required: 'Required',
  Optional: 'Optional',
} as const

export type ParticipantRole = (typeof ParticipantRole)[keyof typeof ParticipantRole]

export type User = {
  id: string
  displayName: string
  email: string
  jobTitle: string
}

export type Meeting = {
  id: string
  title: string
  description: string
  organizerId: string
  duration: number
  status: MeetingStatus
  /** 이 회의가 속한 Teams 채팅/채널. 개인 탭에서 만든 회의는 null. */
  scopeId: string | null
  proposedDate: string
  meetingDate: string | null
  startMinutes: number | null
  teamsJoinUrl: string | null
  createdAt: string
  /** 채팅에 카드를 마지막으로 게시한 시각. 미게시면 null. */
  cardPostedAt: string | null
}

export type Participant = {
  meetingId: string
  userId: string
  role: ParticipantRole
}

export type Availability = {
  meetingId: string
  userId: string
  availabilityMask: string
}

export type Recommendation = {
  startSlot: number
  startLabel: string
  endLabel: string
  score: number
  organizerPresent: boolean
  requiredPresent: number
  requiredTotal: number
  optionalPresent: number
  optionalTotal: number
  contiguousSlots: number
}

export type DirectoryUser = User
