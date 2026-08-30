/**
 * The learning path, mirrored from src/data/levels.ts. Only the stage counts
 * live here — the server needs them to validate progress and compute totals;
 * the copy stays on the client.
 */
export const LEVEL_STAGES: Record<number, number> = { 1: 5, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 }

export const TOTAL_STAGES = Object.values(LEVEL_STAGES).reduce((sum, n) => sum + n, 0)

export type LevelProgress = { levelId: number; stagesDone: number; stages: number }

export function clampStages(levelId: number, stagesDone: number): number {
  const max = LEVEL_STAGES[levelId] ?? 0
  return Math.max(0, Math.min(max, Math.round(stagesDone)))
}

/** Overall completion as a 0-100 percentage across every level. */
export function overallPercent(progress: LevelProgress[]): number {
  const done = progress.reduce((sum, level) => sum + level.stagesDone, 0)
  return TOTAL_STAGES === 0 ? 0 : Math.round((done / TOTAL_STAGES) * 100)
}

/** The level the user is currently working through — the first unfinished one. */
export function currentLevel(progress: LevelProgress[]): number {
  const unfinished = progress.find((level) => level.stagesDone < level.stages)
  return unfinished?.levelId ?? Math.max(...Object.keys(LEVEL_STAGES).map(Number))
}
