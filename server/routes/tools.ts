import type { FastifyInstance } from 'fastify'
import { aiToolSpecs, specById } from '../../shared/aiToolSpecs.ts'
import { ai } from '../adapters/registry.ts'
import * as q from '../db/queries.ts'
import { runTool, validateInputs } from '../tools/runner.ts'

const DEFAULT_RUNS = 10
const MAX_RUNS = 50

/** Accepts `{ inputs: {...} }` and a flat body, which is what a plain form sends. */
const inputsOf = (body: unknown): unknown => {
  const wrapper = (body ?? {}) as { inputs?: unknown }
  return wrapper.inputs && typeof wrapper.inputs === 'object' ? wrapper.inputs : body
}

export default async function toolRoutes(app: FastifyInstance) {
  /** The client renders its forms from these rather than keeping a second copy. */
  app.get('/api/tools', async () => ({ tools: aiToolSpecs, adapter: ai().name }))

  app.post('/api/tools/:toolId/run', async (request, reply) => {
    const spec = specById((request.params as { toolId: string }).toolId)
    if (!spec) return reply.code(404).send({ error: 'unknown tool' })

    const validated = validateInputs(spec, inputsOf(request.body))
    if (!validated.ok) return reply.code(400).send({ error: 'invalid input', errors: validated.errors })

    const { locale } = (request.body ?? {}) as { locale?: string }
    const result = await runTool(spec, validated.inputs, locale === 'en' ? 'en' : 'fa')
    return reply.code(201).send({ run: q.saveToolRun(spec.id, validated.inputs, result) })
  })

  app.get('/api/tools/:toolId/runs', async (request, reply) => {
    const spec = specById((request.params as { toolId: string }).toolId)
    if (!spec) return reply.code(404).send({ error: 'unknown tool' })

    const asked = Number((request.query as { limit?: string }).limit)
    const limit = Number.isFinite(asked) && asked > 0 ? Math.min(Math.floor(asked), MAX_RUNS) : DEFAULT_RUNS
    return { runs: q.listToolRuns(spec.id, limit) }
  })

  app.delete('/api/tools/runs/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    if (!Number.isInteger(id) || !q.deleteToolRun(id)) return reply.code(404).send({ error: 'not found' })
    return { ok: true }
  })
}
