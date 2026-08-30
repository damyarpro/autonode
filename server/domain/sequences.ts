import type { Route } from '../types.ts'

export type TemplateKey =
  | 'hot_intro'
  | 'hot_value'
  | 'hot_offer'
  | 'warm_educate'
  | 'warm_prove'
  | 'warm_offer'
  | 'cold_watch'
  | 'cold_read'
  | 'cold_return'

export type SequenceStepDef = {
  delayMinutes: number
  template: TemplateKey
  /** A reply from the lead cancels the rest of the sequence and re-scores them. */
  stopOnReply: boolean
}

/** The three nurture tracks the router feeds, as data rather than branches. */
export const SEQUENCES: Record<Route, SequenceStepDef[]> = {
  hot: [
    { delayMinutes: 0, template: 'hot_intro', stopOnReply: true },
    { delayMinutes: 20, template: 'hot_value', stopOnReply: true },
    { delayMinutes: 90, template: 'hot_offer', stopOnReply: true },
  ],
  warm: [
    { delayMinutes: 0, template: 'warm_educate', stopOnReply: false },
    { delayMinutes: 60 * 24, template: 'warm_prove', stopOnReply: false },
    { delayMinutes: 60 * 72, template: 'warm_offer', stopOnReply: true },
  ],
  cold: [
    { delayMinutes: 0, template: 'cold_watch', stopOnReply: false },
    { delayMinutes: 60 * 72, template: 'cold_read', stopOnReply: false },
    { delayMinutes: 60 * 168, template: 'cold_return', stopOnReply: false },
  ],
}

export type PlannedStep = { stepIndex: number; template: TemplateKey; dueAt: Date }

/**
 * Lays a route's steps out on the clock. `speed` scales every delay — 1 is real
 * time, 0 makes the whole sequence due immediately, which is what the end-to-end
 * script uses.
 */
export function planSteps(route: Route, from: Date, speed = 1): PlannedStep[] {
  return SEQUENCES[route].map((step, stepIndex) => ({
    stepIndex,
    template: step.template,
    dueAt: new Date(from.getTime() + step.delayMinutes * speed * 60_000),
  }))
}

export function stepDef(route: Route, stepIndex: number): SequenceStepDef | undefined {
  return SEQUENCES[route][stepIndex]
}
