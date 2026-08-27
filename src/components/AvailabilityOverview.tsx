import type { Availability, Participant, User } from '../types/models.ts'
import { parseMask } from '../lib/mask.ts'
import { SLOTS_PER_DAY } from '../lib/constants.ts'
import { hourLabels } from '../lib/mask.ts'

type AvailabilityOverviewProps = {
  users: User[]
  participants: Participant[]
  availabilities: Availability[]
}

export const AvailabilityOverview = ({
  users,
  participants,
  availabilities,
}: AvailabilityOverviewProps) => {
  const userById = new Map(users.map((user) => [user.id, user]))
  const hours = hourLabels()

  const rows = participants.map((participant) => {
    const availability = availabilities.find((item) => item.userId === participant.userId)
    return {
      participant,
      user: userById.get(participant.userId),
      bits: parseMask(availability?.availabilityMask ?? ''),
    }
  })

  const heatmap = Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
    if (rows.length === 0) {
      return 0
    }
    const count = rows.filter((row) => row.bits[slot] === 1).length
    return count / rows.length
  })

  return (
    <div className="overview">
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
      <div className="timetable-row heatmap-row">
        <span className="timetable-name">현황</span>
        <div className="timetable-slots" aria-hidden="true">
          {heatmap.map((heat, slot) => (
            <span key={slot} className="slot slot-heat" style={{ ['--heat' as string]: String(heat) }} />
          ))}
        </div>
      </div>
      {rows.map((row) => (
        <div className="timetable-row" key={row.participant.userId}>
          <span className="timetable-name">
            {row.user?.displayName ?? row.participant.userId}
            <small>{row.participant.role}</small>
          </span>
          <div className="timetable-slots" role="img" aria-label={`${row.user?.displayName} 참석 가능 시간`}>
            {row.bits.map((bit, slot) => (
              <span key={slot} className={bit ? 'slot slot-on slot-readonly' : 'slot slot-off slot-readonly'} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
