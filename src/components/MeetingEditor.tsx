import { useMemo, useState } from 'react'
import { ParticipantPicker } from './ParticipantPicker.tsx'
import { getUserById } from '../data/directory.ts'
import { MAX_DURATION_MINUTES, MIN_DURATION_MINUTES, SLOT_MINUTES } from '../lib/constants.ts'
import { collectionRange, isWithinCollectionRange } from '../lib/dates.ts'
import { ParticipantRole, type Meeting, type Participant, type User } from '../types/models.ts'

type SelectedParticipant = {
  user: User
  role: 'Required' | 'Optional'
}

type MeetingEditorProps = {
  meeting: Meeting
  participants: Participant[]
  organizer: User
  onSave: (meeting: Meeting, participants: Participant[]) => void
  onCancel: () => void
}

const toSelected = (participants: Participant[], organizerId: string): SelectedParticipant[] =>
  participants
    .filter((item) => item.userId !== organizerId && item.role !== ParticipantRole.Organizer)
    .flatMap((item) => {
      const user = getUserById(item.userId)
      return user ? [{ user, role: item.role as 'Required' | 'Optional' }] : []
    })

/** FR-001 입력 항목을 그대로 재사용하는 Organizer 전용 회의 수정 폼. */
export const MeetingEditor = ({
  meeting,
  participants,
  organizer,
  onSave,
  onCancel,
}: MeetingEditorProps) => {
  const range = useMemo(() => collectionRange(), [])
  const [title, setTitle] = useState(meeting.title)
  const [description, setDescription] = useState(meeting.description)
  const [duration, setDuration] = useState(meeting.duration)
  const [proposedDate, setProposedDate] = useState(meeting.proposedDate)
  const [selected, setSelected] = useState<SelectedParticipant[]>(() =>
    toSelected(participants, meeting.organizerId),
  )
  const [error, setError] = useState('')

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

    onSave({ ...meeting, title: title.trim(), description: description.trim(), duration, proposedDate }, [
      { meetingId: meeting.id, userId: meeting.organizerId, role: ParticipantRole.Organizer },
      ...selected.map((item) => ({
        meetingId: meeting.id,
        userId: item.user.id,
        role: item.role === 'Required' ? ParticipantRole.Required : ParticipantRole.Optional,
      })),
    ])
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <label className="field-label" htmlFor="edit-title">
        회의명
      </label>
      <input
        id="edit-title"
        className="text-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <label className="field-label" htmlFor="edit-description">
        설명
      </label>
      <textarea
        id="edit-description"
        className="text-input"
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="form-grid">
        <div>
          <label className="field-label" htmlFor="edit-duration">
            예상 회의 시간 (분)
          </label>
          <input
            id="edit-duration"
            className="text-input"
            type="number"
            min={MIN_DURATION_MINUTES}
            max={MAX_DURATION_MINUTES}
            step={SLOT_MINUTES}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value) || MIN_DURATION_MINUTES)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="edit-date">
            후보 날짜
          </label>
          <input
            id="edit-date"
            className="text-input"
            type="date"
            min={range.min}
            max={range.max}
            value={proposedDate}
            onChange={(event) => setProposedDate(event.target.value)}
          />
        </div>
      </div>

      <ParticipantPicker organizer={organizer} selected={selected} onChange={setSelected} />

      {error && <p className="error">{error}</p>}
      <div className="row-actions">
        <button type="submit" className="btn-primary">
          변경 사항 저장
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          취소
        </button>
      </div>
      <p className="hint">참석자를 제거하면 그 사람이 등록한 참석 가능 시간도 함께 삭제됩니다.</p>
    </form>
  )
}
