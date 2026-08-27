import { useEffect, useState, type ReactNode } from 'react'
import { isAuthConfigured } from '../lib/config.ts'
import { errorMessage } from '../lib/useAsync.ts'
import { SignInRequiredError } from '../services/auth.ts'
import { getMe } from '../services/graph.ts'
import { resolveStore, store } from '../services/activeStore.ts'
import { initTeams, onThemeChange, type TeamsSession, type TeamsTheme } from '../services/teams.ts'
import { SessionContext } from './sessionContext.ts'

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<TeamsSession | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      // teams-js 가 MSAL 보다 먼저 초기화돼야 NAA 브로커가 붙는다.
      const base = await initTeams()

      // Teams 컨텍스트(테넌트·그룹)를 안 뒤에야 어느 저장소를 쓸지 정할 수 있다.
      resolveStore()

      // context.user 는 위조 가능한 클라이언트 값이라, 설정돼 있으면 토큰 기반 /me 로 덮어쓴다.
      let next = base
      if (isAuthConfigured()) {
        try {
          // 부팅에서는 조용한 토큰만 시도한다. 팝업이 필요하면 로그인 버튼으로 넘긴다.
          next = { ...base, user: await getMe({ interactive: false }), authenticated: true }
        } catch (error) {
          next = {
            ...base,
            authError:
              error instanceof SignInRequiredError ? null : errorMessage(error),
            needsSignIn: true,
          }
        }
      }

      try {
        await store.runCleanup()
      } catch (error) {
        // 정리 실패가 앱 전체를 막을 이유는 없다.
        console.warn('daily cleanup failed', error)
      }

      if (cancelled) {
        return
      }
      setSession(next)
      onThemeChange((theme: TeamsTheme) =>
        setSession((current) => (current ? { ...current, theme } : current)),
      )
    }

    void boot().catch((error: unknown) => {
      if (!cancelled) {
        setFatal(errorMessage(error))
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = session?.theme ?? 'default'
  }, [session?.theme])

  if (fatal) {
    return (
      <div className="boot" role="alert">
        <p>앱을 시작하지 못했습니다.</p>
        <p className="error">{fatal}</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="boot" role="status">
        <span className="boot-spinner" aria-hidden="true" />
        <p>Teams 컨텍스트를 확인하는 중…</p>
      </div>
    )
  }

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
