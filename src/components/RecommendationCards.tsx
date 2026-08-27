import type { Recommendation } from '../types/models.ts'
import { SLOT_MINUTES } from '../lib/constants.ts'

type RecommendationCardsProps = {
  items: Recommendation[]
  canConfirm: boolean
  onConfirm: (item: Recommendation) => void
}

export const RecommendationCards = ({ items, canConfirm, onConfirm }: RecommendationCardsProps) => {
  if (items.length === 0) {
    return <p className="muted">아직 추천할 시간이 없습니다. 참석 가능 시간을 먼저 등록하세요.</p>
  }

  return (
    <ol className="reco-list">
      {items.map((item, index) => (
        <li key={item.startSlot} className="reco-card">
          <div>
            <p className="reco-rank">추천 {index + 1}</p>
            <h3>
              {item.startLabel} – {item.endLabel}
            </h3>
            <p className="reco-meta">
              Score {item.score} · Organizer {item.organizerPresent ? '참석' : '불참'} · Required {item.requiredPresent}/
              {item.requiredTotal} · Optional {item.optionalPresent}/{item.optionalTotal} · 연속 {item.contiguousSlots * SLOT_MINUTES}분
            </p>
          </div>
          {canConfirm && (
            <button type="button" className="btn-primary" tabIndex={0} onClick={() => onConfirm(item)}>
              이 시간으로 Teams 회의 생성
            </button>
          )}
        </li>
      ))}
    </ol>
  )
}
