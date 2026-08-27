/**
 * Teams 컨텍스트에서 얻어낸 런타임 힌트.
 *
 * 빌드 시점에 알 수 없고 로그인한 사용자에 따라 달라지는 값들이다.
 * initTeams() 가 한 번 채우고, auth/저장소가 읽는다.
 */
type RuntimeContext = {
  /** 로그인 사용자의 홈 테넌트. MSAL authority 에 쓴다. */
  tenantId: string | null
  /** 팀(채널) 탭이면 그 팀의 M365 그룹 id. 그룹 전용 SharePoint 사이트가 딸려 있다. */
  groupId: string | null
}

const context: RuntimeContext = { tenantId: null, groupId: null }

export const setRuntimeContext = (next: Partial<RuntimeContext>): void => {
  Object.assign(context, next)
}

export const getRuntimeContext = (): Readonly<RuntimeContext> => context
