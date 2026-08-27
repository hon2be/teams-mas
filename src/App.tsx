import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { DIRECTORY_USERS } from './data/directory.ts'
import { signIn } from './services/auth.ts'
import { errorMessage } from './lib/useAsync.ts'
import { setCurrentUserId } from './services/teams.ts'
import { useSession } from './session/sessionContext.ts'

const App = () => {
  const session = useSession()
  const navigate = useNavigate()
  const [signingIn, setSigningIn] = useState(false)
  const [signInError, setSignInError] = useState('')

  // 채팅 카드의 딥링크(subPageId=meetingId)로 들어온 경우 해당 회의로 보낸다.
  useEffect(() => {
    if (session.subPageId) {
      navigate(`/meetings/${session.subPageId}`, { replace: true })
    }
  }, [session.subPageId, navigate])

  return (
    <div className="app-shell">
      <header className="app-bar">
        <NavLink to="/" className="brand">
          MAS
        </NavLink>
        <nav>
          <NavLink to="/" end>
            회의
          </NavLink>
          <NavLink to="/create">생성</NavLink>
        </nav>
        <span className="scope-pill" title="이 탭이 보여주는 범위">
          {session.scopeLabel}
        </span>
        {session.inTeams ? (
          <span className="user-name">{session.user.displayName}</span>
        ) : (
          <label className="user-switch">
            <span>현재 사용자</span>
            <select
              value={session.user.id}
              onChange={(event) => {
                setCurrentUserId(event.target.value)
                window.location.reload()
              }}
              aria-label="현재 사용자 전환"
            >
              {DIRECTORY_USERS.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {session.needsSignIn && (
        <div className="banner banner-warn signin-bar">
          <p>조직 계정으로 로그인하면 실제 참석자 검색과 공유 저장소를 쓸 수 있습니다.</p>
          <div className="row-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={signingIn}
              onClick={() => {
                setSigningIn(true)
                setSignInError('')
                void signIn()
                  .then(() => window.location.reload())
                  .catch((cause: unknown) => {
                    setSignInError(errorMessage(cause))
                    setSigningIn(false)
                  })
              }}
            >
              {signingIn ? '로그인 중…' : '로그인'}
            </button>
          </div>
          {signInError && <p className="error">{signInError}</p>}
        </div>
      )}
      {session.authError && (
        <div className="banner banner-warn">
          <p>로그인 오류: {session.authError}</p>
        </div>
      )}
      <main>
        <Outlet />
      </main>
    </div>
  )
}

export default App
