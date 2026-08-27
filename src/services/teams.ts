import { app, pages } from '@microsoft/teams-js'
import { CURRENT_USER_ID, DIRECTORY_USERS, getUserById } from '../data/directory.ts'
import type { User } from '../types/models.ts'
import { setRuntimeContext } from './runtimeContext.ts'

export type TeamsTheme = 'default' | 'dark' | 'contrast'

export type TeamsSession = {
  /** Teams 호스트 안에서 실행 중인지. false면 브라우저 개발 모드. */
  inTeams: boolean
  user: User
  /** 회의를 격리하는 컨텍스트 키. 채팅/채널 id, 개인 탭·브라우저에서는 null. */
  scopeId: string | null
  scopeLabel: string
  theme: TeamsTheme
  /** 채팅 카드 딥링크가 지정한 회의 id. 없으면 null. */
  subPageId: string | null
  /** Entra 토큰으로 신원이 확인됐는지. false면 user 는 신뢰할 수 없는 힌트다. */
  authenticated: boolean
  /** 인증을 시도했지만 실패한 이유. */
  authError: string | null
  /** 조용한 토큰 획득에 실패해 사용자가 로그인 버튼을 눌러야 하는 상태. */
  needsSignIn: boolean
}

const SCOPE_OVERRIDE_KEY = 'mas.scopeId'

const teamsUserFrom = (context: app.Context): User => {
  const id = context.user?.id ?? CURRENT_USER_ID
  const known = getUserById(id)
  if (known) {
    return known
  }
  const upn = context.user?.userPrincipalName ?? ''
  return {
    id,
    displayName: context.user?.displayName ?? (upn.split('@')[0] || '사용자'),
    email: upn,
    jobTitle: '',
  }
}

const scopeFrom = (context: app.Context): { scopeId: string | null; scopeLabel: string } => {
  const chatId = context.chat?.id
  if (chatId) {
    return { scopeId: `chat:${chatId}`, scopeLabel: '이 채팅' }
  }
  const channelId = context.channel?.id
  if (channelId) {
    return { scopeId: `channel:${channelId}`, scopeLabel: context.channel?.displayName ?? '이 채널' }
  }
  return { scopeId: null, scopeLabel: '개인 탭' }
}

const browserFallback = (): TeamsSession => {
  const storedId = localStorage.getItem('mas.currentUserId') ?? CURRENT_USER_ID
  const scopeId = localStorage.getItem(SCOPE_OVERRIDE_KEY)
  return {
    inTeams: false,
    user: DIRECTORY_USERS.find((user) => user.id === storedId) ?? DIRECTORY_USERS[0],
    scopeId,
    scopeLabel: scopeId ? '시뮬레이션 채팅' : '브라우저',
    theme: 'default',
    subPageId: null,
    authenticated: false,
    authError: null,
    needsSignIn: false,
  }
}

/**
 * Teams 호스트면 실제 컨텍스트를, 아니면 목업 세션을 돌려준다.
 * teams-js는 Teams 밖에서 initialize가 영영 resolve되지 않을 수 있어 타임아웃을 건다.
 */
export const initTeams = async (): Promise<TeamsSession> => {
  try {
    await Promise.race([
      app.initialize(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('teams-init-timeout')), 1500)),
    ])
    const context = await app.getContext()
    const { scopeId, scopeLabel } = scopeFrom(context)

    // 빌드 설정 대신 로그인 사용자에게서 직접 얻는 값들.
    setRuntimeContext({
      tenantId: context.user?.tenant?.id ?? null,
      groupId: context.team?.groupId ?? null,
    })
    app.notifySuccess()
    return {
      inTeams: true,
      user: teamsUserFrom(context),
      scopeId,
      scopeLabel,
      theme: (context.app.theme as TeamsTheme) ?? 'default',
      subPageId: context.page?.subPageId ?? null,
      authenticated: false,
      authError: null,
      needsSignIn: false,
    }
  } catch {
    return browserFallback()
  }
}

export const onThemeChange = (handler: (theme: TeamsTheme) => void): void => {
  try {
    app.registerOnThemeChangeHandler((theme) => handler(theme as TeamsTheme))
  } catch {
    /* Teams 밖에서는 테마 이벤트가 없다 */
  }
}

export const setCurrentUserId = (userId: string): void => {
  localStorage.setItem('mas.currentUserId', userId)
}

export const setSimulatedScopeId = (scopeId: string | null): void => {
  if (scopeId) {
    localStorage.setItem(SCOPE_OVERRIDE_KEY, scopeId)
  } else {
    localStorage.removeItem(SCOPE_OVERRIDE_KEY)
  }
}

export const isConfigPage = (): boolean => window.location.pathname.startsWith('/config')

export { pages }
