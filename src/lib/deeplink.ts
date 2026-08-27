import { TEAMS_APP_ID } from './config.ts'
import { appUrl } from './router.ts'

const TAB_ENTITY_ID = 'mas.home'

/**
 * 채팅 카드의 버튼이 여는 주소.
 * Teams에 설치된 앱이면 탭 딥링크로, 아니면 호스팅된 웹 URL로 떨어진다.
 */
export const meetingDeepLink = (meetingId: string, scopeId: string | null): string => {
  const context = JSON.stringify({
    subEntityId: meetingId,
    ...(scopeId?.startsWith('chat:') ? { chatId: scopeId.slice('chat:'.length) } : {}),
    ...(scopeId?.startsWith('channel:') ? { channelId: scopeId.slice('channel:'.length) } : {}),
  })
  return `https://teams.microsoft.com/l/entity/${TEAMS_APP_ID}/${TAB_ENTITY_ID}?context=${encodeURIComponent(context)}`
}

export const meetingWebLink = (meetingId: string): string => appUrl(`meetings/${meetingId}`)
