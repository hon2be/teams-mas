import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AvailabilityOverview } from '../components/AvailabilityOverview.tsx'
import { MeetingEditor } from '../components/MeetingEditor.tsx'
import { RecommendationCards } from '../components/RecommendationCards.tsx'
import { TimeTable } from '../components/TimeTable.tsx'
import { buildMeetingCard } from '../lib/adaptiveCard.ts'
import { formatKoreanDate } from '../lib/dates.ts'
import { emptyMask, parseMask, serializeMask, slotToMinutes } from '../lib/mask.ts'
import { recommendTimes } from '../lib/recommend.ts'
import { errorMessage, useAsync } from '../lib/useAsync.ts'
import { store } from '../services/activeStore.ts'
import { postCardToChat } from '../services/chatCard.ts'
import { resolveUsers } from '../services/graph.ts'
import { createTeamsMeeting } from '../services/teamsMeeting.ts'
import { useSession } from '../session/sessionContext.ts'
import {
  MeetingStatus,
  type Availability,
  type Meeting,
  type Participant,
  type Recommendation,
  type User,
} from '../types/models.ts'

type MeetingBundle = {
  meeting: Meeting | undefined
  participants: Participant[]
  availabilities: Availability[]
  webhookUrl: string
  userById: Map<string, User>
}

const loadBundle = async (meetingId: string, scopeId: string | null): Promise<MeetingBundle> => {
  const meeting = await store.getMeeting(meetingId)
  if (!meeting) {
    return {
      meeting: undefined,
      participants: [],
      availabilities: [],
      webhookUrl: '',
      userById: new Map(),
    }
  }
  const [participants, availabilities, webhookUrl] = await Promise.all([
    store.listParticipants(meeting.id),
    store.listAvailabilities(meeting.id),
    store.getWebhookUrl(scopeId).catch(() => ''),
  ])
  const userById = await resolveUsers(participants.map((item) => item.userId))
  return { meeting, participants, availabilities, webhookUrl, userById }
}

export const MeetingPage = () => {
  const { meetingId = '' } = useParams()
  const session = useSession()
  const currentUser = session.user

  const bundle = useAsync(() => loadBundle(meetingId, session.scopeId), [meetingId, session.scopeId])

  const [meeting, setMeeting] = useState<Meeting | undefined>(undefined)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [availabilities, setAvailabilities] = useState<Availability[]>([])
  const [bits, setBits] = useState<number[]>(() => parseMask(emptyMask()))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  // 서버에서 온 결과를 편집 가능한 로컬 상태로 옮긴다.
  useEffect(() => {
    if (!bundle.data) {
      return
    }
    setMeeting(bundle.data.meeting)
    setParticipants(bundle.data.participants)
    setAvailabilities(bundle.data.availabilities)
    const mine = bundle.data.availabilities.find((item) => item.userId === currentUser.id)
    setBits(parseMask(mine?.availabilityMask ?? emptyMask()))
  }, [bundle.data, currentUser.id])

  const webhookUrl = bundle.data?.webhookUrl ?? ''
  const isParticipant = participants.some((item) => item.userId === currentUser.id)
  const isOrganizer = meeting?.organizerId === currentUser.id
  const isActive = meeting?.status === MeetingStatus.ACTIVE

  const recommendations = useMemo(
    () => (meeting ? recommendTimes(meeting.duration, participants, availabilities) : []),
    [meeting, participants, availabilities],
  )

  const participantUsers = useMemo(() => {
    const map = new Map<string, User>(bundle.data?.userById ?? [])
    // 편집 직후처럼 아직 해석되지 않은 id 는 최소한 자기 자신은 채워 둔다.
    map.set(currentUser.id, map.get(currentUser.id) ?? currentUser)
    return map
  }, [bundle.data?.userById, currentUser])

  if (bundle.loading) {
    return (
      <section className="page">
        <p className="muted">회의를 불러오는 중…</p>
      </section>
    )
  }

  if (bundle.error) {
    return (
      <section className="page">
        <p className="error">{bundle.error}</p>
        <div className="row-actions">
          <button type="button" className="btn-secondary" onClick={bundle.reload}>
            다시 시도
          </button>
          <Link to="/">목록으로</Link>
        </div>
      </section>
    )
  }

  if (!meeting) {
    return (
      <section className="page">
        <p>회의를 찾을 수 없습니다.</p>
        <Link to="/">목록으로</Link>
      </section>
    )
  }

  const confirmedMeeting = meeting

  const notify = (text: string) => {
    setError('')
    setMessage(text)
  }

  const guard = async (work: () => Promise<void>) => {
    setBusy(true)
    try {
      await work()
    } catch (cause: unknown) {
      setMessage('')
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const saveAvailability = (nextBits: number[]) => {
    const previous = bits
    setBits(nextBits)
    const record = {
      meetingId: confirmedMeeting.id,
      userId: currentUser.id,
      availabilityMask: serializeMask(nextBits),
    }
    // 낙관적 반영 후 저장. 실패하면 되돌린다.
    setAvailabilities((current) => [
      ...current.filter((item) => item.userId !== currentUser.id),
      record,
    ])
    void guard(async () => {
      try {
        await store.upsertAvailability(record)
      } catch (cause) {
        setBits(previous)
        setAvailabilities(await store.listAvailabilities(confirmedMeeting.id))
        throw cause
      }
    })
  }

  // PRD §4: Organizer 회의 수정
  const saveEdits = (nextMeeting: Meeting, nextParticipants: Participant[]) => {
    void guard(async () => {
      await store.upsertMeeting(nextMeeting)
      await store.replaceParticipants(nextMeeting.id, nextParticipants)
      await store.pruneAvailabilities(
        nextMeeting.id,
        nextParticipants.map((item) => item.userId),
      )
      setMeeting(nextMeeting)
      setParticipants(await store.listParticipants(nextMeeting.id))
      setAvailabilities(await store.listAvailabilities(nextMeeting.id))
      setEditing(false)
      notify('회의 정보를 수정했습니다.')
    })
  }

  // PRD §4: Organizer 회의 종료
  const endMeeting = () => {
    void guard(async () => {
      const updated = { ...confirmedMeeting, status: MeetingStatus.COMPLETED }
      await store.upsertMeeting(updated)
      setMeeting(updated)
      notify('회의를 종료했습니다. 60일 뒤 자동 보관, 90일 뒤 자동 삭제됩니다.')
    })
  }

  // FR-008
  const confirmTime = (item: Recommendation) => {
    if (!isOrganizer || !isActive) {
      return
    }
    void guard(async () => {
      const attendees = participants.map(
        (participant) =>
          participantUsers.get(participant.userId) ?? {
            id: participant.userId,
            displayName: participant.userId,
            email: '',
            jobTitle: '',
          },
      )

      // OnlineMeetings.ReadWrite 동의가 없어도 시간 확정 자체는 되어야 한다.
      // 회의 생성만 건너뛰고 주최자가 직접 만들도록 안내한다.
      let joinUrl: string | null = null
      let meetingError = ''
      try {
        joinUrl = (
          await createTeamsMeeting(confirmedMeeting, item.startLabel, item.endLabel, attendees)
        ).joinUrl
      } catch (cause: unknown) {
        meetingError = errorMessage(cause)
      }

      const updated = {
        ...confirmedMeeting,
        meetingDate: confirmedMeeting.proposedDate,
        startMinutes: slotToMinutes(item.startSlot),
        teamsJoinUrl: joinUrl,
      }
      await store.upsertMeeting(updated)
      setMeeting(updated)
      notify(
        joinUrl
          ? 'Teams 회의가 생성되었고 참석자 초대 링크가 준비되었습니다.'
          : `${item.startLabel}–${item.endLabel} 로 확정했습니다. Teams 회의 자동 생성은 실패했으니 직접 만들어 주세요. (${meetingError})`,
      )
    })
  }

  // 채팅에 Adaptive Card 게시 (Workflows 웹훅, 서버 불필요)
  const postCard = () => {
    void guard(async () => {
      const card = buildMeetingCard({
        meeting: confirmedMeeting,
        participants,
        respondedUserIds: new Set(availabilities.map((item) => item.userId)),
        recommendations,
        userById: participantUsers,
      })
      const result = await postCardToChat(webhookUrl, card)
      if (!result.ok) {
        setMessage('')
        setError(result.reason)
        return
      }
      const updated = { ...confirmedMeeting, cardPostedAt: new Date().toISOString() }
      await store.upsertMeeting(updated)
      setMeeting(updated)
      notify(
        result.verified
          ? '채팅에 현황 카드를 게시했습니다.'
          : '카드를 전송했습니다. 브라우저가 응답을 읽을 수 없어(CORS) 채팅에서 직접 확인해 주세요.',
      )
    })
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">{confirmedMeeting.status}</p>
          <h1>{confirmedMeeting.title}</h1>
          <p className="lede">
            {confirmedMeeting.description} · {formatKoreanDate(confirmedMeeting.proposedDate)} ·{' '}
            {confirmedMeeting.duration}분
          </p>
        </div>
        <div className="row-actions">
          {isOrganizer && isActive && !editing && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(true)}>
              회의 수정
            </button>
          )}
          {isOrganizer && isActive && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={endMeeting}>
              회의 종료
            </button>
          )}
          <Link className="btn-secondary" to="/">
            목록
          </Link>
        </div>
      </header>

      {confirmedMeeting.teamsJoinUrl && (
        <div className="banner">
          <p>Teams 회의가 확정되었습니다.</p>
          <a href={confirmedMeeting.teamsJoinUrl} target="_blank" rel="noreferrer">
            {confirmedMeeting.teamsJoinUrl}
          </a>
        </div>
      )}

      {editing && isOrganizer && (
        <div className="panel">
          <h2>회의 수정</h2>
          <MeetingEditor
            meeting={confirmedMeeting}
            participants={participants}
            organizer={currentUser}
            onSave={saveEdits}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}

      {isParticipant && isActive && !confirmedMeeting.teamsJoinUrl && !editing && (
        <div className="panel">
          <div className="panel-head">
            <h2>내 참석 가능 시간</h2>
            <p className="hint">클릭/드래그로 칠하고, Shift+드래그로 블록을 옮깁니다.</p>
          </div>
          <TimeTable bits={bits} onChange={saveAvailability} label={currentUser.displayName} />
        </div>
      )}

      <div className="panel">
        <h2>참석 현황</h2>
        <AvailabilityOverview
          users={[...participantUsers.values()]}
          participants={participants}
          availabilities={availabilities}
        />
      </div>

      <div className="panel">
        <h2>추천 시간 Top 3</h2>
        <RecommendationCards
          items={recommendations}
          canConfirm={Boolean(isOrganizer && !busy && !confirmedMeeting.teamsJoinUrl && isActive)}
          onConfirm={confirmTime}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>채팅에 현황 카드 게시</h2>
          <p className="hint">
            {webhookUrl
              ? '카드에는 응답 현황과 추천 Top 3, 그리고 이 탭을 여는 버튼이 담깁니다.'
              : 'Workflows 웹훅 URL이 설정되어 있지 않습니다. 탭 설정(/config)에서 등록하세요.'}
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="btn-primary" disabled={!webhookUrl || busy} onClick={postCard}>
            {confirmedMeeting.cardPostedAt ? '카드 다시 게시' : '카드 게시'}
          </button>
          {!webhookUrl && (
            <Link className="btn-secondary" to="/config">
              웹훅 설정
            </Link>
          )}
        </div>
        {confirmedMeeting.cardPostedAt && (
          <p className="hint">
            마지막 게시: {new Date(confirmedMeeting.cardPostedAt).toLocaleString('ko-KR')}
          </p>
        )}
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
