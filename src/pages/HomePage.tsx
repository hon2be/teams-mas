import { Link } from 'react-router-dom'
import { formatKoreanDate } from '../lib/dates.ts'
import { useAsync } from '../lib/useAsync.ts'
import { isMockStore, store } from '../services/activeStore.ts'
import { useSession } from '../session/sessionContext.ts'

export const HomePage = () => {
  const session = useSession()
  const { data: meetings, loading, error, reload } = useAsync(
    () => store.listMeetings(session.scopeId),
    [session.scopeId],
  )

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Meeting Availability Scheduler</p>
          <h1>회의 조율</h1>
          <p className="lede">
            {session.scopeId
              ? `${session.scopeLabel}의 참석 가능 시간을 모으고, 최적 시간을 추천한 뒤 Teams 회의를 만듭니다.`
              : '참석 가능 시간을 모으고, 최적 시간을 추천한 뒤 Teams 회의를 만듭니다.'}
          </p>
        </div>
        <Link className="btn-primary" to="/create">
          회의 만들기
        </Link>
      </header>

      {isMockStore() && (
        <div className="banner banner-warn">
          <p>
            <strong>이 브라우저에만 저장됩니다</strong> — 다른 참석자와 공유되지 않습니다.
          </p>
          <p className="hint">
            {session.inTeams && session.scopeId?.startsWith('chat:')
              ? '채팅에는 딸린 SharePoint 사이트가 없습니다. 공유하려면 관리자가 공용 사이트를 지정해야 합니다. 팀 채널에서는 설정 없이 바로 공유됩니다.'
              : session.inTeams
                ? '공유 저장소에 연결되지 않았습니다. 관리자 동의(Sites.ReadWrite.All)가 필요합니다.'
                : 'Teams 밖에서는 항상 로컬 저장소를 씁니다. 실제 공유는 Teams 탭에서 동작합니다.'}
          </p>
        </div>
      )}

      {loading && <p className="muted">불러오는 중…</p>}

      {error && (
        <div className="empty-card">
          <p className="error">{error}</p>
          <button type="button" className="btn-secondary" onClick={reload}>
            다시 시도
          </button>
        </div>
      )}

      {!loading && !error && meetings?.length === 0 && (
        <div className="empty-card">
          <p>아직 회의가 없습니다. 1분 안에 생성하고 참석자를 초대하세요.</p>
          <Link className="btn-secondary" to="/create">
            첫 회의 생성
          </Link>
        </div>
      )}

      {!error && meetings && meetings.length > 0 && (
        <ul className="meeting-list">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <Link className="meeting-card" to={`/meetings/${meeting.id}`}>
                <div>
                  <h2>{meeting.title}</h2>
                  <p>
                    {formatKoreanDate(meeting.meetingDate ?? meeting.proposedDate)} · {meeting.duration}분
                    {meeting.cardPostedAt ? ' · 채팅 게시됨' : ''}
                  </p>
                </div>
                <span className={`status-pill status-${meeting.status.toLowerCase()}`}>
                  {meeting.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
