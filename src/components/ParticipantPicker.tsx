import { useEffect, useMemo, useState } from 'react'
import type { User } from '../types/models.ts'
import { ParticipantRole } from '../types/models.ts'
import { errorMessage } from '../lib/useAsync.ts'
import { SignInRequiredError } from '../services/auth.ts'
import { searchPeople } from '../services/graph.ts'

type SelectedParticipant = {
  user: User
  role: 'Required' | 'Optional'
}

type ParticipantPickerProps = {
  organizer: User
  selected: SelectedParticipant[]
  onChange: (selected: SelectedParticipant[]) => void
}

export const ParticipantPicker = ({ organizer, selected, onChange }: ParticipantPickerProps) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSearching(true)
    setSearchError('')
    searchPeople(query)
      .then((people) => {
        if (!cancelled) {
          setResults(people.filter((user) => user.id !== organizer.id))
        }
      })
      .catch((cause: unknown) => {
        // 로그인/권한 실패를 '검색 결과 없음' 으로 위장하면 원인을 못 찾는다.
        if (!cancelled) {
          setResults([])
          setSearchError(
            cause instanceof SignInRequiredError
              ? '조직 사용자를 검색하려면 상단에서 로그인하세요.'
              : errorMessage(cause),
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSearching(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [query, organizer.id])

  const selectedIds = useMemo(() => new Set(selected.map((item) => item.user.id)), [selected])

  const addUser = (user: User) => {
    if (selectedIds.has(user.id)) {
      return
    }
    onChange([...selected, { user, role: ParticipantRole.Required }])
    setQuery('')
  }

  const removeUser = (userId: string) => {
    onChange(selected.filter((item) => item.user.id !== userId))
  }

  const toggleRole = (userId: string) => {
    onChange(
      selected.map((item) =>
        item.user.id === userId
          ? { ...item, role: item.role === ParticipantRole.Required ? ParticipantRole.Optional : ParticipantRole.Required }
          : item,
      ),
    )
  }

  return (
    <div className="picker">
      <label className="field-label" htmlFor="people-search">
        참석자 (Microsoft Entra ID)
      </label>
      <input
        id="people-search"
        className="text-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="이름, 메일, 직무로 검색"
        aria-label="조직 사용자 검색"
      />
      {query && (
        <ul className="picker-results" role="listbox" aria-label="검색 결과">
          {results.map((user) => (
            <li key={user.id}>
              <button type="button" className="picker-result" tabIndex={0} onClick={() => addUser(user)}>
                <strong>{user.displayName}</strong>
                <span>
                  {user.jobTitle} · {user.email}
                </span>
              </button>
            </li>
          ))}
          {searching && results.length === 0 && <li className="muted">검색 중…</li>}
          {!searching && !searchError && results.length === 0 && (
            <li className="muted">검색 결과가 없습니다.</li>
          )}
          {searchError && <li className="error">{searchError}</li>}
        </ul>
      )}
      <ul className="chip-list">
        <li className="chip chip-organizer">
          {organizer.displayName}
          <em>Organizer · Required</em>
        </li>
        {selected.map((item) => (
          <li key={item.user.id} className={item.role === 'Required' ? 'chip chip-required' : 'chip chip-optional'}>
            <button type="button" className="chip-toggle" tabIndex={0} onClick={() => toggleRole(item.user.id)}>
              {item.user.displayName}
              <em>{item.role}</em>
            </button>
            <button
              type="button"
              className="chip-remove"
              aria-label={`${item.user.displayName} 제거`}
              tabIndex={0}
              onClick={() => removeUser(item.user.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">칩을 클릭하면 필수/선택 참석자를 전환합니다. Organizer는 항상 필수입니다.</p>
    </div>
  )
}
