import type { Availability, Meeting, Participant } from '../types/models.ts'

/**
 * 저장소 인터페이스. localStorage 목업과 SharePoint List 가 같은 모양을 구현한다.
 * PRD §11 기준으로 리스트는 Meetings / Participants / Availabilities 3개다.
 */
export type Store = {
  readonly kind: 'local' | 'sharepoint'
  listMeetings(scopeId: string | null): Promise<Meeting[]>
  getMeeting(id: string): Promise<Meeting | undefined>
  upsertMeeting(meeting: Meeting): Promise<void>
  listParticipants(meetingId: string): Promise<Participant[]>
  replaceParticipants(meetingId: string, participants: Participant[]): Promise<void>
  listAvailabilities(meetingId: string): Promise<Availability[]>
  upsertAvailability(availability: Availability): Promise<void>
  pruneAvailabilities(meetingId: string, keepUserIds: string[]): Promise<void>
  /** §10 Daily Cleanup. 상태 전환 + DELETED 회의의 하위 데이터 삭제. */
  runCleanup(): Promise<void>
  getWebhookUrl(scopeId: string | null): Promise<string>
  setWebhookUrl(scopeId: string | null, url: string): Promise<void>
}
