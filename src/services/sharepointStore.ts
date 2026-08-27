import {
  SHAREPOINT_HOSTNAME,
  SHAREPOINT_SITE_PATH,
  SITES_SCOPES,
  STORAGE_SITE_NAME,
} from '../lib/config.ts'
import { nextStatus } from '../lib/lifecycle.ts'
import { todayIso } from '../lib/dates.ts'
import { MeetingStatus, type Meeting, type ParticipantRole } from '../types/models.ts'
import { GraphError, graph, graphAll } from './graphClient.ts'
import { getRuntimeContext } from './runtimeContext.ts'
import {
  AVAILABILITIES_LIST,
  MEETINGS_LIST,
  PARTICIPANTS_LIST,
  SETTINGS_LIST,
  columnPayload,
  type ListSpec,
} from './sharepointSchema.ts'
import type { Store } from './store.ts'

type Fields = Record<string, string | number | null | undefined>
type Item = { id: string; fields: Fields }

/** 비인덱스 컬럼 필터가 조용히 실패하지 않도록 Graph 가 요구하는 헤더. */
const FILTER_HEADERS = { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' }

/** 이 저장소의 모든 호출은 Sites 권한을 명시해 증분 동의가 정확히 걸리게 한다. */
const SITES = { scopes: SITES_SCOPES } as const

const quote = (value: string): string => `'${value.replaceAll("'", "''")}'`

let siteIdPromise: Promise<string> | null = null
const listIdCache = new Map<string, string>()

/**
 * SharePoint 호스트명. 설정돼 있으면 그 값을, 없으면 Graph 로 알아낸다.
 * /sites/root 는 테넌트의 루트 사이트라 호스트명이 항상 정확하다.
 */
const resolveHostname = async (): Promise<string> => {
  if (SHAREPOINT_HOSTNAME) {
    return SHAREPOINT_HOSTNAME
  }
  const root = await graph<{ siteCollection?: { hostname?: string } }>(
    '/sites/root?$select=siteCollection,webUrl',
    { scopes: ['Sites.ReadWrite.All'] },
  )
  const hostname = root.siteCollection?.hostname
  if (!hostname) {
    throw new Error('SharePoint 호스트명을 찾지 못했습니다. VITE_SHAREPOINT_HOSTNAME 을 직접 지정하세요.')
  }
  return hostname
}

/**
 * 데이터를 담을 사이트를 정한다.
 *
 * 1. 팀(채널) 탭이면 그 팀의 M365 그룹 사이트 — 팀마다 자기 데이터를 갖는다
 * 2. 아니면 VITE_SHAREPOINT_SITE_PATH 로 지정한 공용 사이트
 *
 * 팀 사이트를 먼저 보는 이유: 전사 배포 시 팀마다 분리 저장되어야
 * 권한이 자연스럽게 팀 경계를 따르고, 사이트 하나에 전사 데이터가 몰리지 않는다.
 * 공용 사이트는 딸린 사이트가 없는 그룹 채팅·개인 탭의 폴백으로만 쓰인다.
 */
const getSiteId = (): Promise<string> => {
  siteIdPromise ??= (async () => {
    const { groupId } = getRuntimeContext()
    if (groupId) {
      const site = await graph<{ id: string }>(`/groups/${groupId}/sites/root?$select=id`, {
        scopes: SITES_SCOPES,
      })
      return site.id
    }

    if (SHAREPOINT_SITE_PATH) {
      const hostname = await resolveHostname()
      try {
        const site = await graph<{ id: string }>(`/sites/${hostname}:${SHAREPOINT_SITE_PATH}`, SITES)
        return site.id
      } catch (cause: unknown) {
        // 공용 사이트에 접근 권한이 없는 사용자가 채팅 탭을 열면 여기로 온다.
        // Graph 원문(itemNotFound/accessDenied)만 보여주면 원인을 알 수 없다.
        if (cause instanceof GraphError && (cause.status === 403 || cause.status === 404)) {
          throw new Error(
            `${STORAGE_SITE_NAME} 팀에 가입해야 입력한 시간이 서로에게 공유됩니다. ` +
              `이 채팅의 일정은 ${STORAGE_SITE_NAME} 팀에 저장되는데 접근 권한이 없습니다. ` +
              '팀 채널에서 쓰는 경우에는 가입이 필요 없습니다.',
          )
        }
        throw cause
      }
    }

    throw new Error(
      '저장할 SharePoint 사이트를 정할 수 없습니다. 팀 채널 탭에서 열거나, ' +
        'VITE_SHAREPOINT_SITE_PATH 에 공용 사이트를 지정하세요.',
    )
  })()
  return siteIdPromise
}

/** 리스트가 없으면 스키마대로 만든다. 첫 실행에서 한 번만 일어난다. */
const ensureList = async (spec: ListSpec): Promise<string> => {
  const cached = listIdCache.get(spec.displayName)
  if (cached) {
    return cached
  }

  const siteId = await getSiteId()
  const existing = await graphAll<{ id: string; displayName: string }>(
    `/sites/${siteId}/lists?$select=id,displayName`,
    SITES,
  )
  const found = existing.find((list) => list.displayName === spec.displayName)
  if (found) {
    listIdCache.set(spec.displayName, found.id)
    return found.id
  }

  const created = await graph<{ id: string }>(`/sites/${siteId}/lists`, {
    method: 'POST',
    scopes: SITES_SCOPES,
    body: {
      displayName: spec.displayName,
      list: { template: 'genericList' },
      columns: spec.columns.map(columnPayload),
    },
  })
  listIdCache.set(spec.displayName, created.id)
  return created.id
}

const itemsPath = async (spec: ListSpec, query: string): Promise<string> => {
  const siteId = await getSiteId()
  const listId = await ensureList(spec)
  return `/sites/${siteId}/lists/${listId}/items?expand=fields${query}`
}

const queryItems = async (spec: ListSpec, filter?: string): Promise<Item[]> =>
  graphAll<Item>(
    await itemsPath(spec, filter ? `&$filter=${encodeURIComponent(filter)}` : ''),
    { headers: FILTER_HEADERS, scopes: SITES_SCOPES },
  )

const createItem = async (spec: ListSpec, fields: Fields): Promise<void> => {
  const siteId = await getSiteId()
  const listId = await ensureList(spec)
  await graph(`/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    scopes: SITES_SCOPES,
    body: { fields },
  })
}

const patchItem = async (spec: ListSpec, itemId: string, fields: Fields): Promise<void> => {
  const siteId = await getSiteId()
  const listId = await ensureList(spec)
  await graph(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
    method: 'PATCH',
    scopes: SITES_SCOPES,
    body: fields,
  })
}

const deleteItem = async (spec: ListSpec, itemId: string): Promise<void> => {
  const siteId = await getSiteId()
  const listId = await ensureList(spec)
  await graph(`/sites/${siteId}/lists/${listId}/items/${itemId}`, {
    method: 'DELETE',
    scopes: SITES_SCOPES,
  })
}

const str = (value: Fields[string]): string => (value == null ? '' : String(value))
const nullable = (value: Fields[string]): string | null => {
  const text = str(value)
  return text.length > 0 ? text : null
}

const toMeeting = (item: Item): Meeting => ({
  id: str(item.fields.MeetingId),
  title: str(item.fields.Title),
  description: str(item.fields.Description),
  organizerId: str(item.fields.OrganizerId),
  duration: Number(item.fields.Duration ?? 0),
  status: (str(item.fields.Status) || MeetingStatus.ACTIVE) as MeetingStatus,
  scopeId: nullable(item.fields.ScopeId),
  proposedDate: str(item.fields.ProposedDate),
  meetingDate: nullable(item.fields.MeetingDate),
  startMinutes: item.fields.StartMinutes == null ? null : Number(item.fields.StartMinutes),
  teamsJoinUrl: nullable(item.fields.TeamsJoinUrl),
  createdAt: str(item.fields.CreatedAtIso),
  cardPostedAt: nullable(item.fields.CardPostedAt),
})

const meetingFields = (meeting: Meeting): Fields => ({
  Title: meeting.title,
  MeetingId: meeting.id,
  ScopeId: meeting.scopeId ?? '',
  Description: meeting.description,
  OrganizerId: meeting.organizerId,
  Duration: meeting.duration,
  Status: meeting.status,
  ProposedDate: meeting.proposedDate,
  MeetingDate: meeting.meetingDate ?? '',
  StartMinutes: meeting.startMinutes ?? 0,
  TeamsJoinUrl: meeting.teamsJoinUrl ?? '',
  CardPostedAt: meeting.cardPostedAt ?? '',
  CreatedAtIso: meeting.createdAt,
})

const findMeetingItem = async (meetingId: string): Promise<Item | undefined> => {
  const items = await queryItems(MEETINGS_LIST, `fields/MeetingId eq ${quote(meetingId)}`)
  return items[0]
}

/**
 * SharePoint List 백엔드 (PRD §11).
 * 리스트는 첫 접근 시 자동 생성되므로 사이트만 미리 만들어 두면 된다.
 */
export const sharePointStore: Store = {
  kind: 'sharepoint',

  async listMeetings(scopeId) {
    const filter =
      scopeId === null
        ? `fields/Status ne ${quote(MeetingStatus.DELETED)}`
        : `fields/ScopeId eq ${quote(scopeId)} and fields/Status ne ${quote(MeetingStatus.DELETED)}`
    const items = await queryItems(MEETINGS_LIST, filter)
    return items.map(toMeeting).filter((meeting) => meeting.status !== MeetingStatus.DELETED)
  },

  async getMeeting(id) {
    const item = await findMeetingItem(id)
    if (!item) {
      return undefined
    }
    const meeting = toMeeting(item)
    return meeting.status === MeetingStatus.DELETED ? undefined : meeting
  },

  async upsertMeeting(meeting) {
    const existing = await findMeetingItem(meeting.id)
    if (existing) {
      await patchItem(MEETINGS_LIST, existing.id, meetingFields(meeting))
    } else {
      await createItem(MEETINGS_LIST, meetingFields(meeting))
    }
  },

  async listParticipants(meetingId) {
    const items = await queryItems(PARTICIPANTS_LIST, `fields/MeetingId eq ${quote(meetingId)}`)
    return items.map((item) => ({
      meetingId,
      userId: str(item.fields.UserId),
      role: str(item.fields.Role) as ParticipantRole,
    }))
  },

  async replaceParticipants(meetingId, participants) {
    const existing = await queryItems(PARTICIPANTS_LIST, `fields/MeetingId eq ${quote(meetingId)}`)
    await Promise.all(existing.map((item) => deleteItem(PARTICIPANTS_LIST, item.id)))
    for (const participant of participants) {
      await createItem(PARTICIPANTS_LIST, {
        Title: `${meetingId}:${participant.userId}`,
        MeetingId: meetingId,
        UserId: participant.userId,
        Role: participant.role,
      })
    }
  },

  async listAvailabilities(meetingId) {
    const items = await queryItems(AVAILABILITIES_LIST, `fields/MeetingId eq ${quote(meetingId)}`)
    return items.map((item) => ({
      meetingId,
      userId: str(item.fields.UserId),
      availabilityMask: str(item.fields.AvailabilityMask),
    }))
  },

  async upsertAvailability(availability) {
    const items = await queryItems(
      AVAILABILITIES_LIST,
      `fields/MeetingId eq ${quote(availability.meetingId)} and fields/UserId eq ${quote(availability.userId)}`,
    )
    const fields: Fields = {
      Title: `${availability.meetingId}:${availability.userId}`,
      MeetingId: availability.meetingId,
      UserId: availability.userId,
      AvailabilityMask: availability.availabilityMask,
    }
    if (items[0]) {
      await patchItem(AVAILABILITIES_LIST, items[0].id, fields)
    } else {
      await createItem(AVAILABILITIES_LIST, fields)
    }
  },

  async pruneAvailabilities(meetingId, keepUserIds) {
    const keep = new Set(keepUserIds)
    const items = await queryItems(AVAILABILITIES_LIST, `fields/MeetingId eq ${quote(meetingId)}`)
    await Promise.all(
      items
        .filter((item) => !keep.has(str(item.fields.UserId)))
        .map((item) => deleteItem(AVAILABILITIES_LIST, item.id)),
    )
  },

  // §10 Daily Cleanup: 상태 전환 후 DELETED 회의의 하위 항목까지 지운다.
  async runCleanup() {
    const today = todayIso()
    const items = await queryItems(MEETINGS_LIST)

    for (const item of items) {
      const meeting = toMeeting(item)
      const status = nextStatus(meeting, today)
      if (status === meeting.status) {
        continue
      }

      if (status === MeetingStatus.DELETED) {
        const [participants, availabilities] = await Promise.all([
          queryItems(PARTICIPANTS_LIST, `fields/MeetingId eq ${quote(meeting.id)}`),
          queryItems(AVAILABILITIES_LIST, `fields/MeetingId eq ${quote(meeting.id)}`),
        ])
        await Promise.all([
          ...participants.map((row) => deleteItem(PARTICIPANTS_LIST, row.id)),
          ...availabilities.map((row) => deleteItem(AVAILABILITIES_LIST, row.id)),
        ])
        await deleteItem(MEETINGS_LIST, item.id)
        continue
      }

      await patchItem(MEETINGS_LIST, item.id, { Status: status })
    }
  },

  async getWebhookUrl(scopeId) {
    const items = await queryItems(SETTINGS_LIST, `fields/ScopeKey eq ${quote(scopeId ?? '__personal__')}`)
    return str(items[0]?.fields.WebhookUrl)
  },

  async setWebhookUrl(scopeId, url) {
    const key = scopeId ?? '__personal__'
    const items = await queryItems(SETTINGS_LIST, `fields/ScopeKey eq ${quote(key)}`)
    const trimmed = url.trim()

    if (!trimmed) {
      await Promise.all(items.map((item) => deleteItem(SETTINGS_LIST, item.id)))
      return
    }
    const fields: Fields = { Title: key, ScopeKey: key, WebhookUrl: trimmed }
    if (items[0]) {
      await patchItem(SETTINGS_LIST, items[0].id, fields)
    } else {
      await createItem(SETTINGS_LIST, fields)
    }
  },
}

export { GraphError }
