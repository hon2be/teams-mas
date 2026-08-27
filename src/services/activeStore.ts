import { isAuthConfigured, SHAREPOINT_SITE_PATH } from '../lib/config.ts'
import { localStore } from './localStore.ts'
import { getRuntimeContext } from './runtimeContext.ts'
import { sharePointStore } from './sharepointStore.ts'
import type { Store } from './store.ts'

let resolved: Store | null = null

/**
 * SharePoint 를 쓸 수 있는 조건.
 * 사이트 경로가 설정돼 있거나, 팀 채널 탭이라 그룹 사이트를 쓸 수 있으면 된다.
 */
const canUseSharePoint = (): boolean => {
  if (!isAuthConfigured()) {
    return false
  }
  return SHAREPOINT_SITE_PATH.length > 0 || Boolean(getRuntimeContext().groupId)
}

/** Teams 컨텍스트를 읽은 뒤 호출한다. 그 전까지는 목업으로 동작한다. */
export const resolveStore = (): Store => {
  resolved = canUseSharePoint() ? sharePointStore : localStore
  return resolved
}

const active = (): Store => resolved ?? localStore

/** 화면 코드가 쓰는 저장소. 실제 백엔드는 부팅 시점에 정해진다. */
export const store: Store = {
  get kind() {
    return active().kind
  },
  listMeetings: (scopeId) => active().listMeetings(scopeId),
  getMeeting: (id) => active().getMeeting(id),
  upsertMeeting: (meeting) => active().upsertMeeting(meeting),
  listParticipants: (meetingId) => active().listParticipants(meetingId),
  replaceParticipants: (meetingId, participants) =>
    active().replaceParticipants(meetingId, participants),
  listAvailabilities: (meetingId) => active().listAvailabilities(meetingId),
  upsertAvailability: (availability) => active().upsertAvailability(availability),
  pruneAvailabilities: (meetingId, keepUserIds) =>
    active().pruneAvailabilities(meetingId, keepUserIds),
  runCleanup: () => active().runCleanup(),
  getWebhookUrl: (scopeId) => active().getWebhookUrl(scopeId),
  setWebhookUrl: (scopeId, url) => active().setWebhookUrl(scopeId, url),
}

export const isMockStore = (): boolean => active().kind === 'local'
