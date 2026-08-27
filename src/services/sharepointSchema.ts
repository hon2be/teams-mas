/** PRD §11/§12 를 SharePoint List 컬럼으로 옮긴 정의. 첫 실행 시 자동 생성한다. */

export type ColumnSpec = {
  name: string
  kind: 'text' | 'number' | 'note'
  /** $filter 대상 컬럼은 인덱싱해야 대용량에서 안전하다. */
  indexed?: boolean
}

export type ListSpec = {
  displayName: string
  columns: ColumnSpec[]
}

export const MEETINGS_LIST: ListSpec = {
  displayName: 'MAS_Meetings',
  columns: [
    { name: 'MeetingId', kind: 'text', indexed: true },
    { name: 'ScopeId', kind: 'text', indexed: true },
    { name: 'Description', kind: 'note' },
    { name: 'OrganizerId', kind: 'text' },
    { name: 'Duration', kind: 'number' },
    { name: 'Status', kind: 'text', indexed: true },
    { name: 'ProposedDate', kind: 'text' },
    { name: 'MeetingDate', kind: 'text' },
    { name: 'StartMinutes', kind: 'number' },
    { name: 'TeamsJoinUrl', kind: 'note' },
    { name: 'CardPostedAt', kind: 'text' },
    { name: 'CreatedAtIso', kind: 'text' },
  ],
}

export const PARTICIPANTS_LIST: ListSpec = {
  displayName: 'MAS_Participants',
  columns: [
    { name: 'MeetingId', kind: 'text', indexed: true },
    { name: 'UserId', kind: 'text', indexed: true },
    { name: 'Role', kind: 'text' },
  ],
}

export const AVAILABILITIES_LIST: ListSpec = {
  displayName: 'MAS_Availabilities',
  columns: [
    { name: 'MeetingId', kind: 'text', indexed: true },
    { name: 'UserId', kind: 'text', indexed: true },
    { name: 'AvailabilityMask', kind: 'note' },
  ],
}

export const SETTINGS_LIST: ListSpec = {
  displayName: 'MAS_Settings',
  columns: [
    { name: 'ScopeKey', kind: 'text', indexed: true },
    { name: 'WebhookUrl', kind: 'note' },
  ],
}

export const ALL_LISTS = [MEETINGS_LIST, PARTICIPANTS_LIST, AVAILABILITIES_LIST, SETTINGS_LIST]

export const columnPayload = (column: ColumnSpec): Record<string, unknown> => ({
  name: column.name,
  indexed: column.indexed ?? false,
  ...(column.kind === 'number'
    ? { number: {} }
    : column.kind === 'note'
      ? { text: { allowMultipleLines: true, textType: 'plain' } }
      : { text: {} }),
})
