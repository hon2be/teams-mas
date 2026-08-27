import { useRef, useState } from 'react'
import { SLOTS_PER_DAY } from '../lib/constants.ts'
import { findBlock, hourLabels, moveBlock, paintRange, slotToLabel } from '../lib/mask.ts'

type TimeTableProps = {
  bits: number[]
  onChange: (bits: number[]) => void
  readOnly?: boolean
  label?: string
}

type DragState = {
  mode: 'paint' | 'move'
  paintValue: 0 | 1
  anchorSlot: number
  block: { start: number; end: number } | null
  sourceBits: number[]
}

export const TimeTable = ({ bits, onChange, readOnly = false, label }: TimeTableProps) => {
  const dragRef = useRef<DragState | null>(null)
  const previewRef = useRef<number[] | null>(null)
  const [previewBits, setPreviewBits] = useState<number[] | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const displayBits = previewBits ?? bits
  const hours = hourLabels()

  const setPreview = (next: number[] | null) => {
    previewRef.current = next
    setPreviewBits(next)
  }

  const finishDrag = () => {
    if (previewRef.current) {
      onChange(previewRef.current)
    }
    dragRef.current = null
    setPreview(null)
  }

  const previewFromSlot = (slot: number) => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    const next =
      drag.mode === 'move' && drag.block
        ? moveBlock(drag.sourceBits, drag.block.start, drag.block.end, slot)
        : paintRange(drag.sourceBits, drag.anchorSlot, slot, drag.paintValue)
    setPreview(next)
  }

  const onSlotPointerDown = (slot: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (readOnly) {
      return
    }
    event.preventDefault()
    const block = findBlock(bits, slot)
    dragRef.current = {
      mode: event.shiftKey && block ? 'move' : 'paint',
      paintValue: bits[slot] ? 0 : 1,
      anchorSlot: slot,
      block,
      sourceBits: bits,
    }
    previewFromSlot(slot)
  }

  const onSlotPointerEnter = (slot: number) => {
    if (!dragRef.current || readOnly) {
      return
    }
    previewFromSlot(slot)
  }

  const onPointerUp = () => {
    finishDrag()
  }

  const onSlotKeyDown = (slot: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (readOnly) {
      return
    }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      onChange(paintRange(bits, slot, slot, bits[slot] ? 0 : 1))
    }
    if (event.key === 'ArrowRight' && slot < SLOTS_PER_DAY - 1) {
      tableRef.current?.querySelector<HTMLButtonElement>(`[data-slot="${slot + 1}"]`)?.focus()
    }
    if (event.key === 'ArrowLeft' && slot > 0) {
      tableRef.current?.querySelector<HTMLButtonElement>(`[data-slot="${slot - 1}"]`)?.focus()
    }
  }

  return (
    <div className="timetable" ref={tableRef} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="timetable-hours" aria-hidden="true">
        <span className="timetable-name-spacer" />
        <div className="hour-track">
          {hours.map((hour) => (
            <span key={hour} className="timetable-hour">
              {String(hour).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>
      <div className="timetable-row">
        <span className="timetable-name">{label}</span>
        <div className="timetable-slots" role="grid" aria-label={`${label ?? '참석 가능 시간'} 타임테이블`}>
          {displayBits.map((bit, slot) => (
            <button
              key={slot}
              type="button"
              className={['slot', bit ? 'slot-on' : 'slot-off', readOnly ? 'slot-readonly' : '']
                .filter(Boolean)
                .join(' ')}
              data-slot={slot}
              tabIndex={0}
              aria-label={`${slotToLabel(slot)} ${bit ? '가능' : '불가'}`}
              aria-pressed={bit === 1}
              disabled={readOnly}
              onPointerDown={(event) => onSlotPointerDown(slot, event)}
              onPointerEnter={() => onSlotPointerEnter(slot)}
              onKeyDown={(event) => onSlotKeyDown(slot, event)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
