import type { FastifyInstance } from 'fastify'
import { gatherFacts } from '../db/queries.ts'
import { buildMetrics } from '../domain/pipeline-view.ts'

export default async function pipeline(app: FastifyInstance) {
  app.get('/api/pipeline', async () => ({
    metrics: buildMetrics(gatherFacts()),
    at: new Date().toISOString(),
  }))
}
