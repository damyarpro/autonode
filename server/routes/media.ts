/**
 * The HTTP face of the two production nodes. Thin on purpose: check the body,
 * call `server/media/media.ts`, return the job row.
 *
 * Validation failures come back as `field:code` strings, never as sentences —
 * the client owns the bilingual copy.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { adVideo, voiceover } from '../adapters/registry.ts'
import { mediaDir } from '../adapters/media/types.ts'
import { listMediaJobs, renderAdVideo, renderVoiceover } from '../media/media.ts'
import { deleteMediaJob } from '../db/queries.ts'

const MAX_SCRIPT = 5000
const MAX_BRIEF = 4000
const MAX_VOICE = 120
const MAX_STYLE = 80

/** Only what this route wrote: a uuid and an extension, never a path. */
const RENDERED_FILE = /^[a-f0-9-]{36}\.mp3$/

type Field = { id: string; value: unknown; required: boolean; maxLength: number }

/** Same contract as the tool runner: one `field:code` per problem. */
function check(fields: Field[]): { ok: true; values: Record<string, string> } | { ok: false; errors: string[] } {
  const errors: string[] = []
  const values: Record<string, string> = {}

  for (const field of fields) {
    if (field.value === undefined || field.value === null) {
      if (field.required) errors.push(`${field.id}:required`)
      continue
    }
    if (typeof field.value !== 'string') {
      errors.push(`${field.id}:not_text`)
      continue
    }
    const text = field.value.trim()
    if (text === '') {
      if (field.required) errors.push(`${field.id}:required`)
      continue
    }
    if (text.length > field.maxLength) {
      errors.push(`${field.id}:too_long:${field.maxLength}`)
      continue
    }
    values[field.id] = text
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, values }
}

/** The app has two locales; anything else is a client bug, not a default. */
const locale = (value: unknown): { ok: true; value: string | undefined } | { ok: false } => {
  if (value === undefined || value === null || value === '') return { ok: true, value: undefined }
  if (value === 'fa' || value === 'en') return { ok: true, value }
  return { ok: false }
}

export default async function mediaRoutes(app: FastifyInstance) {
  app.post('/api/media/voice', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>
    const chosen = locale(body.locale)
    const validated = check([
      { id: 'script', value: body.script, required: true, maxLength: MAX_SCRIPT },
      { id: 'voice', value: body.voice, required: false, maxLength: MAX_VOICE },
    ])
    if (!chosen.ok || !validated.ok) {
      const errors = [...(validated.ok ? [] : validated.errors), ...(chosen.ok ? [] : ['locale:not_an_option'])]
      return reply.code(400).send({ error: 'invalid input', errors })
    }

    const job = await renderVoiceover({
      script: validated.values.script!,
      locale: chosen.value,
      voice: validated.values.voice,
    })
    return reply.code(201).send({ job })
  })

  app.post('/api/media/video', async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>
    const chosen = locale(body.locale)
    const validated = check([
      { id: 'brief', value: body.brief, required: true, maxLength: MAX_BRIEF },
      { id: 'style', value: body.style, required: false, maxLength: MAX_STYLE },
    ])
    if (!chosen.ok || !validated.ok) {
      const errors = [...(validated.ok ? [] : validated.errors), ...(chosen.ok ? [] : ['locale:not_an_option'])]
      return reply.code(400).send({ error: 'invalid input', errors })
    }

    const job = await renderAdVideo({
      brief: validated.values.brief!,
      locale: chosen.value,
      style: validated.values.style,
    })
    return reply.code(201).send({ job })
  })

  app.get('/api/media', async (request) => {
    const query = request.query as { limit?: string; kind?: string }
    const kind = query.kind === 'voice' || query.kind === 'video' ? query.kind : undefined
    return {
      jobs: listMediaJobs(Number(query.limit), kind),
      adapters: { voiceover: voiceover().name, adVideo: adVideo().name },
    }
  })

  /** Serves audio this server rendered and wrote under the media directory. */
  app.get('/api/media/file/:name', async (request, reply) => {
    const { name } = request.params as { name: string }
    if (!RENDERED_FILE.test(name)) return reply.code(404).send({ error: 'not found' })

    const file = join(mediaDir(), name)
    if (!existsSync(file)) return reply.code(404).send({ error: 'not found' })
    return reply.type('audio/mpeg').send(readFileSync(file))
  })

  app.delete('/api/media/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    if (!Number.isInteger(id) || !deleteMediaJob(id)) return reply.code(404).send({ error: 'not found' })
    return { ok: true }
  })
}
