import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParticipantPicker } from '../components/ParticipantPicker.tsx'
import {
  DEFAULT_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  SLOT_MINUTES,
} from '../lib/constants.ts'
import { collectionRange, isWithinCollectionRange, todayIso } from '../lib/dates.ts'
import { errorMessage } from '../lib/useAsync.ts'
import { store } from '../services/activeStore.ts'
import { useSession } from '../session/sessionContext.ts'
import { MeetingStatus, ParticipantRole, type User } from '../types/models.ts'

type SelectedParticipant = {
  user: User
  role: 'Required' | 'Optional'
}

export const CreateMeetingPage = () => {
  const navigate = useNavigate()
  const session = useSession()
  const organizer = session.user
  const range = useMemo(() => collectionRange(), [])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(60)
  const [proposedDate, setProposedDate] = useState(todayIso())
  const [selected, setSelected] = useState<SelectedParticipant[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim()) {
      setError('회의명을 입력하세요.')
      return
    }
    if (!isWithinCollectionRange(proposedDate)) {
      setError(`회의 날짜는 ${range.min} ~ ${range.max} 범위만 가능합니다.`)
      return
    }
    if (duration < MIN_DURATION_MINUTES || duration > MAX_DURATION_MINUTES || duration % SLOT_MINUTES !== 0) {
      setError(`예상 회의 시간은 ${MIN_DURATION_MINUTES}~${MAX_DURATION_MINUTES}분, ${SLOT_MINUTES}분 단위입니다.`)
      return
    }

    const id = crypto.randomUUID()
    const meeting = {
      id,
      title: title.trim(),
      description: description.trim(),
      organizerId: organizer.id,
      duration,
      status: MeetingStatus.ACTIVE,
      scopeId: session.scopeId,
      proposedDate,
      meetingDate: null,
      startMinutes: null,
      teamsJoinUrl: null,
      createdAt: new Date().toISOString(),
      cardPostedAt: null,
    }
    const participants = [
      { meetingId: id, userId: organizer.id, role: ParticipantRole.Organizer },
      ...selected.map((item) => ({
        meetingId: id,
        userId: item.user.id,
        role: item.role === 'Required' ? ParticipantRole.Required : ParticipantRole.Optional,
      })),
    ]

    setSaving(true)
    setError('')
    void (async () => {
      try {
        await store.upsertMeeting(meeting)
        await store.replaceParticipants(id, participants)
        navigate(`/meetings/${id}`)
      } catch (cause: unknown) {
        setError(errorMessage(cause))
        setSaving(false)
      }
    })()
  }

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">FR-001</p>
          <h1>회의 생성</h1>
        </div>
      </header>
      <form className="form-card" onSubmit={submit}>
        <label className="field-label" htmlFor="title">
          회의명
        </label>
        <input
          id="title"
          className="text-input"
          value={title}
          placeholder="예: 아키텍처 리뷰"
          onChange={(event) => setTitle(event.target.value)}
        />

        <label className="field-label" htmlFor="description">
          설명
        </label>
        <textarea
          id="description"
          className="text-input"
          rows={3}
          value={description}
          placeholder="회의 목적을 간단히 적으세요"
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="form-grid">
          <div>
            <label className="field-label" htmlFor="duration">
              예상 회의 시간 (분)
            </label>
            <input
              id="duration"
              className="text-input"
              type="number"
              min={MIN_DURATION_MINUTES}
              max={MAX_DURATION_MINUTES}
              step={SLOT_MINUTES}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value) || DEFAULT_DURATION_MINUTES)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="date">
              후보 날짜
            </label>
            <input
              id="date"
              className="text-input"
              type="date"
              min={range.min}
              max={range.max}
              value={proposedDate}
              onChange={(event) => setProposedDate(event.target.value)}
            />
          </div>
        </div>
        <p className="hint">
          생성 가능 범위: {range.min} ~ {range.max} · 기본 30분 · 최소 30분 · 최대 480분 · 슬롯 10분
        </p>

        <ParticipantPicker organizer={organizer} selected={selected} onChange={setSelected} />

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? '만드는 중…' : '회의 만들고 시간 수집 시작'}
        </button>
      </form>
    </section>
  )
}
