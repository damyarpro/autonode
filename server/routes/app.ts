import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.ts'
import { ai } from '../adapters/registry.ts'
import { clampStages, currentLevel, LEVEL_STAGES, overallPercent, TOTAL_STAGES } from '../domain/levels.ts'
import { missingFields, TONES, type Tone } from '../domain/business.ts'
import { getBusiness, saveBusiness } from '../db/queries.ts'
import { CHANNELS, type Channel } from '../types.ts'
import type { ChatTurn } from '../adapters/types.ts'

type ProfileRow = {
  id: number
  display_name: string
  full_name: string | null
  phone: string | null
  headline: string
  plan: string
  plan_expires: string | null
  points: number
  bot_id: string | null
  bot_username: string | null
}

const sql = {
  profile: () => db().prepare('SELECT * FROM app_profile WHERE id = 1').get() as ProfileRow | undefined,
  progress: () =>
    db().prepare('SELECT level_id, stages_done FROM level_progress ORDER BY level_id').all() as {
      level_id: number
      stages_done: number
    }[],
}

/** Creates the single profile row and one progress row per level on first read. */
function ensureSeedRows(): void {
  db().prepare('INSERT OR IGNORE INTO app_profile (id) VALUES (1)').run()
  const insert = db().prepare('INSERT OR IGNORE INTO level_progress (level_id) VALUES (?)')
  for (const levelId of Object.keys(LEVEL_STAGES)) insert.run(Number(levelId))
}

const readProgress = () => {
  ensureSeedRows()
  return sql.progress().map((row) => ({
    levelId: row.level_id,
    stagesDone: row.stages_done,
    stages: LEVEL_STAGES[row.level_id] ?? 0,
  }))
}

export default async function appRoutes(app: FastifyInstance) {
  app.get('/api/profile', async () => {
    ensureSeedRows()
    const profile = sql.profile()!
    const progress = readProgress()
    return {
      profile: {
        displayName: profile.display_name,
        fullName: profile.full_name,
        phone: profile.phone,
        headline: profile.headline,
        plan: profile.plan,
        planExpires: profile.plan_expires,
        points: profile.points,
        bot: profile.bot_id ? { id: profile.bot_id, username: profile.bot_username } : null,
        level: currentLevel(progress),
      },
    }
  })

  app.patch('/api/profile', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<{
      displayName: string
      fullName: string
      phone: string
      headline: string
    }>
    const fields: [string, unknown][] = []
    if (typeof body.displayName === 'string') fields.push(['display_name', body.displayName.slice(0, 80)])
    if (typeof body.fullName === 'string') fields.push(['full_name', body.fullName.slice(0, 120)])
    if (typeof body.phone === 'string') fields.push(['phone', body.phone.slice(0, 32)])
    if (typeof body.headline === 'string') fields.push(['headline', body.headline.slice(0, 120)])
    if (fields.length === 0) return reply.code(400).send({ error: 'nothing to update' })

    ensureSeedRows()
    db()
      .prepare(
        `UPDATE app_profile SET ${fields.map(([key]) => `${key} = ?`).join(', ')},
         updated_at = datetime('now') WHERE id = 1`,
      )
      .run(...(fields.map(([, value]) => value) as never[]))
    return { ok: true }
  })

  app.get('/api/business', async () => {
    const business = getBusiness()
    return { business, missing: missingFields(business) }
  })

  app.patch('/api/business', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>
    const patch: Record<string, unknown> = {}

    const text = (key: string, max: number) => {
      const value = body[key]
      if (typeof value === 'string') patch[key] = value.trim().slice(0, max)
    }
    text('name', 120)
    text('whatWeSell', 600)
    text('audience', 300)
    text('notes', 600)

    if (typeof body.ctaUrl === 'string') {
      const url = body.ctaUrl.trim()
      // A malformed link would end up in generated posts, so reject it here.
      if (url && !/^https?:\/\/\S+$/.test(url)) return reply.code(400).send({ error: 'invalid input', errors: ['ctaUrl:not_a_url'] })
      patch.ctaUrl = url || null
    }
    if (typeof body.tone === 'string') {
      if (!TONES.includes(body.tone as Tone)) return reply.code(400).send({ error: 'invalid input', errors: ['tone:not_an_option'] })
      patch.tone = body.tone
    }
    if (body.priceToman !== undefined) {
      const price = Number(body.priceToman)
      if (!Number.isFinite(price) || price < 0) return reply.code(400).send({ error: 'invalid input', errors: ['priceToman:not_a_number'] })
      patch.priceToman = price
    }
    if (Array.isArray(body.channels)) {
      patch.channels = body.channels.filter((c): c is Channel => CHANNELS.includes(c as Channel))
    }

    if (Object.keys(patch).length === 0) return reply.code(400).send({ error: 'nothing to update' })

    const business = saveBusiness(patch)
    return { business, missing: missingFields(business) }
  })

  app.get('/api/progress', async () => {
    const progress = readProgress()
    return {
      levels: progress,
      totalStages: TOTAL_STAGES,
      stagesDone: progress.reduce((sum, level) => sum + level.stagesDone, 0),
      percent: overallPercent(progress),
      currentLevel: currentLevel(progress),
    }
  })

  app.post('/api/progress/:levelId', async (request, reply) => {
    const levelId = Number((request.params as { levelId: string }).levelId)
    if (!LEVEL_STAGES[levelId]) return reply.code(404).send({ error: 'unknown level' })

    const { stagesDone } = (request.body ?? {}) as { stagesDone?: number }
    ensureSeedRows()
    const next =
      typeof stagesDone === 'number'
        ? clampStages(levelId, stagesDone)
        : // No body means "advance by one", which is what the level card does.
          clampStages(levelId, (readProgress().find((l) => l.levelId === levelId)?.stagesDone ?? 0) + 1)

    db()
      .prepare("UPDATE level_progress SET stages_done = ?, updated_at = datetime('now') WHERE level_id = ?")
      .run(next, levelId)

    const progress = readProgress()
    return { levels: progress, percent: overallPercent(progress), currentLevel: currentLevel(progress) }
  })

  app.get('/api/coach/history', async () => ({
    messages: db()
      .prepare('SELECT id, role, content, at FROM coach_messages ORDER BY id ASC LIMIT 200')
      .all(),
    adapter: ai().name,
  }))

  app.delete('/api/coach/history', async () => {
    db().prepare('DELETE FROM coach_messages').run()
    return { ok: true }
  })

  app.post('/api/coach', async (request, reply) => {
    const { message, locale } = (request.body ?? {}) as { message?: string; locale?: string }
    if (!message?.trim()) return reply.code(400).send({ error: 'message is required' })

    ensureSeedRows()
    const profile = sql.profile()!
    const progress = readProgress()

    const insert = db().prepare('INSERT INTO coach_messages (role, content) VALUES (?, ?)')
    insert.run('user', message.trim())

    const history = db()
      .prepare('SELECT role, content FROM coach_messages ORDER BY id DESC LIMIT 12')
      .all() as ChatTurn[]

    const answer = await ai().coach({
      messages: history.reverse(),
      locale: locale === 'en' ? 'en' : 'fa',
      context: {
        levelId: currentLevel(progress),
        percent: overallPercent(progress),
        headline: profile.headline,
      },
    })

    insert.run('assistant', answer)
    return { answer, adapter: ai().name }
  })
}
