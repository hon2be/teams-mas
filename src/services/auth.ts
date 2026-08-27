import type { AccountInfo, IPublicClientApplication } from '@azure/msal-browser'
import { BASE_SCOPES, ENTRA_CLIENT_ID, ENTRA_TENANT_ID, isAuthConfigured } from '../lib/config.ts'
import { getRuntimeContext } from './runtimeContext.ts'

/** 조용히는 토큰을 못 받고 사용자 조작이 필요한 상태. */
export class SignInRequiredError extends Error {
  constructor() {
    super('로그인이 필요합니다.')
    this.name = 'SignInRequiredError'
  }
}

let clientPromise: Promise<IPublicClientApplication> | null = null

/**
 * NAA(Nested App Authentication) 클라이언트.
 *
 * msal-browser 5.x 에서는 createNestablePublicClientApplication 자체가 NAA 컨트롤러를
 * 만들기 때문에 예전의 supportsNestedAppAuth 플래그가 필요 없다.
 * Teams 안에서는 호스트가 브로커가 되어 팝업 없이 토큰을 준다.
 * Teams 밖(브라우저 직접 접속)에서는 msal-browser 가 알아서 표준 SPA 흐름으로 폴백한다.
 * teams-js 초기화가 먼저 끝나야 하므로 initTeams() 이후에만 호출한다.
 */
const getClient = (): Promise<IPublicClientApplication> => {
  if (!isAuthConfigured()) {
    return Promise.reject(new Error('auth-not-configured'))
  }
  // 목업 모드에서는 MSAL 번들을 아예 받지 않도록 동적 import 한다.
  // 테넌트는 ① 명시 설정 ② Teams 가 알려준 로그인 사용자의 테넌트 ③ organizations 순으로 정한다.
  // Teams 안에서는 ②가 잡히므로 설정을 비워둬도 된다.
  const tenant = ENTRA_TENANT_ID || getRuntimeContext().tenantId || 'organizations'

  clientPromise ??= import('@azure/msal-browser').then((msal) =>
    msal.createNestablePublicClientApplication({
      auth: {
        clientId: ENTRA_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${tenant}`,
        // 기본값은 현재 페이지 URL 이라 화면마다 달라져 Entra 등록과 어긋난다.
        // 고정된 전용 페이지를 써서 등록해야 할 URI 를 하나로 못 박는다.
        redirectUri: new URL(`${import.meta.env.BASE_URL}blank.html`.replace(/\/{2,}/g, '/'), window.location.origin).toString(),
      },
      cache: { cacheLocation: 'sessionStorage' },
    }),
  )
  return clientPromise
}

const pickAccount = (client: IPublicClientApplication, loginHint?: string): AccountInfo | null => {
  const active = client.getActiveAccount()
  if (active) {
    return active
  }
  const all = client.getAllAccounts()
  const matched = loginHint
    ? all.find((account) => account.username?.toLowerCase() === loginHint.toLowerCase())
    : undefined
  const chosen = matched ?? all[0] ?? null
  if (chosen) {
    client.setActiveAccount(chosen)
  }
  return chosen
}

/**
 * 상호작용(팝업)은 한 번에 하나만 떠야 한다.
 * 동시에 두 개가 뜨면 MSAL 이 interaction_in_progress 로 둘 다 실패시킨다.
 */
let interactiveLock: Promise<unknown> = Promise.resolve()

const runExclusive = <T>(work: () => Promise<T>): Promise<T> => {
  const result = interactiveLock.then(work, work)
  interactiveLock = result.catch(() => undefined)
  return result
}

const silentToken = async (
  client: IPublicClientApplication,
  scopes: string[],
  loginHint?: string,
): Promise<string | null> => {
  const account = pickAccount(client, loginHint)
  if (!account) {
    return null
  }
  try {
    const result = await client.acquireTokenSilent({ scopes, account })
    return result.accessToken
  } catch (error) {
    const { InteractionRequiredAuthError } = await import('@azure/msal-browser')
    if (!(error instanceof InteractionRequiredAuthError)) {
      throw error
    }
    return null
  }
}

/**
 * Graph 호출용 access token.
 *
 * 기본은 조용한 획득만 한다. 배경 데이터 로딩이 팝업을 띄우면
 * 브라우저 팝업 차단기에 막히거나 응답이 없어 화면이 멈춘다.
 * 팝업은 사용자가 로그인 버튼을 눌렀을 때(signIn)만 뜬다.
 */
export const getGraphToken = async (
  scopes: string[] = BASE_SCOPES,
  loginHint?: string,
  options: { interactive?: boolean } = {},
): Promise<string> => {
  const client = await getClient()

  const cached = await silentToken(client, scopes, loginHint)
  if (cached) {
    return cached
  }

  if (!options.interactive) {
    throw new SignInRequiredError()
  }

  return runExclusive(async () => {
    // 대기하는 사이 앞선 팝업이 로그인을 끝냈을 수 있다. 팝업을 또 띄우기 전에 다시 확인한다.
    const afterWait = await silentToken(client, scopes, loginHint)
    if (afterWait) {
      return afterWait
    }
    const result = await client.acquireTokenPopup({ scopes, loginHint })
    client.setActiveAccount(result.account)
    return result.accessToken
  })
}

/** 로그인된 사용자의 Entra objectId. 서버가 검증하는 유일하게 신뢰 가능한 신원. */
export const getSignedInAccount = async (loginHint?: string): Promise<AccountInfo | null> => {
  if (!isAuthConfigured()) {
    return null
  }
  try {
    const client = await getClient()
    return pickAccount(client, loginHint)
  } catch {
    return null
  }
}

/**
 * 사용자가 명시적으로 누르는 로그인. 여기서만 팝업이 뜬다.
 * 관리자 동의가 필요 없는 최소 권한만 요청해 로그인이 막히지 않게 한다.
 */
export const signIn = async (loginHint?: string): Promise<void> => {
  await getGraphToken(BASE_SCOPES, loginHint, { interactive: true })
}

export const signOut = async (): Promise<void> => {
  if (!isAuthConfigured()) {
    return
  }
  const client = await getClient()
  const account = client.getActiveAccount()
  if (account) {
    await client.logoutPopup({ account })
  }
}
