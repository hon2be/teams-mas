import type { Meeting, Participant, Recommendation, User } from '../types/models.ts'
import { ParticipantRole } from '../types/models.ts'
import { formatKoreanDate } from './dates.ts'
import { meetingDeepLink, meetingWebLink } from './deeplink.ts'
import { SLOT_MINUTES } from './constants.ts'

type CardInput = {
  meeting: Meeting
  participants: Participant[]
  respondedUserIds: Set<string>
  recommendations: Recommendation[]
  userById: Map<string, User>
}

const roleLabel = (role: Participant['role']): string =>
  role === ParticipantRole.Organizer ? '주최' : role === ParticipantRole.Required ? '필수' : '선택'

const respondentFacts = ({ participants, respondedUserIds, userById }: CardInput) =>
  participants.map((participant) => ({
    title: `${userById.get(participant.userId)?.displayName ?? participant.userId} (${roleLabel(participant.role)})`,
    value: respondedUserIds.has(participant.userId) ? '✅ 등록 완료' : '⌛ 미등록',
  }))

const recommendationBlocks = (recommendations: Recommendation[]) => {
  if (recommendations.length === 0) {
    return [
      {
        type: 'TextBlock',
        text: '아직 추천할 시간이 없습니다. 참석 가능 시간을 먼저 등록해 주세요.',
        wrap: true,
        isSubtle: true,
      },
    ]
  }

  return recommendations.map((item, index) => ({
    type: 'ColumnSet',
    spacing: index === 0 ? 'Medium' : 'Small',
    columns: [
      {
        type: 'Column',
        width: 'auto',
        items: [{ type: 'TextBlock', text: `${index + 1}위`, weight: 'Bolder', color: 'Accent' }],
      },
      {
        type: 'Column',
        width: 'stretch',
        items: [
          { type: 'TextBlock', text: `${item.startLabel} – ${item.endLabel}`, weight: 'Bolder', wrap: true },
          {
            type: 'TextBlock',
            text: `필수 ${item.requiredPresent}/${item.requiredTotal} · 선택 ${item.optionalPresent}/${item.optionalTotal} · 연속 ${item.contiguousSlots * SLOT_MINUTES}분`,
            isSubtle: true,
            wrap: true,
            spacing: 'None',
          },
        ],
      },
      {
        type: 'Column',
        width: 'auto',
        items: [{ type: 'TextBlock', text: `${item.score}점`, isSubtle: true }],
      },
    ],
  }))
}

/**
 * 채팅에 게시할 Adaptive Card.
 *
 * 카드 안에서 시간을 직접 입력받으려면 Action.Execute(= 봇 백엔드)가 필요하다.
 * 서버리스를 유지하려고 여기서는 현황 요약 + 탭 딥링크(Action.OpenUrl)만 담는다.
 */
export const buildMeetingCard = (input: CardInput): Record<string, unknown> => {
  const { meeting, participants, respondedUserIds, recommendations } = input
  const responded = participants.filter((item) => respondedUserIds.has(item.userId)).length
  const confirmed = Boolean(meeting.teamsJoinUrl)

  const actions: Record<string, unknown>[] = [
    {
      type: 'Action.OpenUrl',
      title: confirmed ? '회의 열기' : '내 가능 시간 등록',
      url: meetingDeepLink(meeting.id, meeting.scopeId),
      style: 'positive',
    },
    {
      type: 'Action.OpenUrl',
      title: '브라우저에서 열기',
      url: meetingWebLink(meeting.id),
    },
  ]

  if (meeting.teamsJoinUrl) {
    actions.unshift({ type: 'Action.OpenUrl', title: 'Teams 회의 참가', url: meeting.teamsJoinUrl })
  }

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: confirmed ? '회의 확정' : '참석 가능 시간 수집 중',
        isSubtle: true,
        spacing: 'None',
      },
      { type: 'TextBlock', text: meeting.title, size: 'Large', weight: 'Bolder', wrap: true },
      ...(meeting.description
        ? [{ type: 'TextBlock', text: meeting.description, wrap: true, spacing: 'None' }]
        : []),
      {
        type: 'FactSet',
        facts: [
          { title: '후보 날짜', value: formatKoreanDate(meeting.proposedDate) },
          { title: '예상 시간', value: `${meeting.duration}분` },
          { title: '응답 현황', value: `${responded} / ${participants.length}명` },
        ],
      },
      { type: 'TextBlock', text: '추천 시간 Top 3', weight: 'Bolder', separator: true },
      ...recommendationBlocks(recommendations),
      { type: 'TextBlock', text: '참석자', weight: 'Bolder', separator: true },
      { type: 'FactSet', facts: respondentFacts(input) },
    ],
    actions,
    msteams: { width: 'Full' },
  }
}
