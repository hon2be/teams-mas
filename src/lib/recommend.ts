import type { Availability, Participant, Recommendation } from '../types/models.ts'
import { ParticipantRole } from '../types/models.ts'
import { ROLE_WEIGHT, SLOT_MINUTES, SLOTS_PER_DAY, TOP_RECOMMENDATIONS } from './constants.ts'
import { parseMask, slotToLabel, windowEndLabel } from './mask.ts'

type ScoredWindow = Recommendation & {
  requiredRate: number
}

const isAvailableInWindow = (bits: number[], startSlot: number, windowSlots: number): boolean => {
  for (let offset = 0; offset < windowSlots; offset += 1) {
    if (!bits[startSlot + offset]) {
      return false
    }
  }
  return true
}

const contiguousFreeSlots = (masks: number[][], startSlot: number): number => {
  if (masks.length === 0) {
    return SLOTS_PER_DAY - startSlot
  }

  let length = 0
  for (let slot = startSlot; slot < SLOTS_PER_DAY; slot += 1) {
    const everyoneFree = masks.every((mask) => mask[slot] === 1)
    if (!everyoneFree) {
      break
    }
    length += 1
  }
  return length
}

export const recommendTimes = (
  durationMinutes: number,
  participants: Participant[],
  availabilities: Availability[],
): Recommendation[] => {
  const windowSlots = durationMinutes / SLOT_MINUTES
  if (!Number.isInteger(windowSlots) || windowSlots < 1) {
    return []
  }

  const availabilityByUser = new Map(
    availabilities.map((item) => [item.userId, parseMask(item.availabilityMask)]),
  )

  const byRole = (role: Participant['role']) =>
    participants.filter((participant) => participant.role === role)

  const organizers = byRole(ParticipantRole.Organizer)
  const required = byRole(ParticipantRole.Required)
  const optional = byRole(ParticipantRole.Optional)

  const maskFor = (userId: string) => availabilityByUser.get(userId) ?? parseMask('')

  const requiredAndOrganizerMasks = [...organizers, ...required].map((participant) =>
    maskFor(participant.userId),
  )

  const scored: ScoredWindow[] = []
  const lastStart = SLOTS_PER_DAY - windowSlots

  for (let startSlot = 0; startSlot <= lastStart; startSlot += 1) {
    const organizerPresent = organizers.every((participant) =>
      isAvailableInWindow(maskFor(participant.userId), startSlot, windowSlots),
    )
    const requiredPresent = required.filter((participant) =>
      isAvailableInWindow(maskFor(participant.userId), startSlot, windowSlots),
    ).length
    const optionalPresent = optional.filter((participant) =>
      isAvailableInWindow(maskFor(participant.userId), startSlot, windowSlots),
    ).length

    const organizerScore = organizerPresent ? ROLE_WEIGHT.Organizer * organizers.length : 0
    const requiredScore = requiredPresent * ROLE_WEIGHT.Required
    const optionalScore = optionalPresent * ROLE_WEIGHT.Optional
    const requiredRate = required.length === 0 ? 1 : requiredPresent / required.length

    scored.push({
      startSlot,
      startLabel: slotToLabel(startSlot),
      endLabel: windowEndLabel(startSlot, durationMinutes),
      score: organizerScore + requiredScore + optionalScore,
      organizerPresent,
      requiredPresent,
      requiredTotal: required.length,
      optionalPresent,
      optionalTotal: optional.length,
      contiguousSlots: contiguousFreeSlots(requiredAndOrganizerMasks, startSlot),
      requiredRate,
    })
  }

  const ranked = organizers.length > 0 ? scored.filter((item) => item.organizerPresent) : scored

  ranked.sort((left, right) => {
    if (left.requiredRate !== right.requiredRate) {
      return right.requiredRate - left.requiredRate
    }
    if (left.optionalPresent !== right.optionalPresent) {
      return right.optionalPresent - left.optionalPresent
    }
    if (left.contiguousSlots !== right.contiguousSlots) {
      return right.contiguousSlots - left.contiguousSlots
    }
    if (left.score !== right.score) {
      return right.score - left.score
    }
    return left.startSlot - right.startSlot
  })

  const picked: Recommendation[] = []
  for (const candidate of ranked) {
    const overlaps = picked.some(
      (item) =>
        candidate.startSlot < item.startSlot + windowSlots &&
        item.startSlot < candidate.startSlot + windowSlots,
    )
    if (overlaps) {
      continue
    }
    picked.push(candidate)
    if (picked.length === TOP_RECOMMENDATIONS) {
      break
    }
  }

  return picked
}
