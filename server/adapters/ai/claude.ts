import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { env } from '../../env.ts'
import { templateAi } from './template.ts'
import type { AiAdapter, CoachInput, DraftInput, NextBestAction, ToolRunInput } from '../types.ts'
import type { AiToolSpec, ToolRunResult } from '../../../shared/aiToolSpecs.ts'

const NextBestActionSchema = z.object({
  action: z.enum(['send_followup', 'book_call', 'send_checkout', 'wait', 'close_lost']),
  reason: z.string(),
  confidence: z.number(),
})

// Stable prefix, cached so repeated calls only pay for the lead-specific tail.
const SYSTEM = `You write short, direct sales follow-ups for a B2B automation studio.
Rules: one message only, no greeting boilerplate beyond a name, no emoji spam,
never invent facts about the customer, never promise a price. Match the language
of the lead's locale exactly: fa means Persian, en means English.`

const COACH_SYSTEM = `You are the MonetizeAI coach: a direct, practical business
mentor for solo founders building an AI-assisted business. Answer in the user's
locale — fa means Persian, en means English. Be concrete and short: name the next
action, not a lecture. Never invent numbers about the user's business, and never
promise income. The learning path has seven levels: choose the idea, build the
first sellable version, build a trusted brand, build the audience machine, build
the online sales infrastructure, build the funnel that earns, full automation.`

const TOOL_SYSTEM = `You run the in-app AI tools of MonetizeAI, a Persian-first app
for solo founders building an AI-assisted business. Each tool takes what the founder
typed and returns one structured answer.
Rules: answer in the caller's locale exactly — fa means Persian, en means English.
Be concrete and specific to what they wrote, and reuse their own words for their
business, audience and skills. Never invent facts, numbers, revenue or results about
them, and never promise income. One action or one idea per entry; no preamble, no
markdown, no headings inside an entry. Every list or steps block needs at least three
entries; every text block is one short paragraph.`

const client = () => new Anthropic({ apiKey: env.anthropicApiKey })

/**
 * The output schema is derived from the spec, so adding a tool to
 * shared/aiToolSpecs.ts needs no change here.
 */
const toolSchema = (spec: AiToolSpec) => {
  const shape: Record<string, z.ZodType> = {
    summary: z.string().describe('One or two sentences naming what this answer gets the founder.'),
  }
  for (const section of spec.sections) {
    shape[section.id] =
      section.kind === 'text'
        ? z.string().describe(`${section.label.en}: one short paragraph.`)
        : z
            .array(z.string())
            .describe(
              section.kind === 'steps'
                ? `${section.label.en}: at least three ordered steps, one action each.`
                : `${section.label.en}: at least three entries, one idea each.`,
            )
  }
  return z.object(shape)
}

/** Select fields carry a code; the model reads the label instead. */
const answered = (spec: AiToolSpec, inputs: Record<string, string>) =>
  spec.fields
    .map((field) => {
      const raw = inputs[field.id] ?? ''
      const option = field.options?.find((choice) => choice.value === raw)
      return `${field.label.en}: ${option ? option.label.en : raw || '(left blank)'}`
    })
    .join('\n')

const toolPrompt = ({ spec, inputs, locale }: ToolRunInput) =>
  [
    `Tool: ${spec.title.en} — ${spec.subtitle.en}`,
    `What it must produce: ${spec.brief}`,
    `Locale: ${locale}`,
    '',
    'What the founder typed:',
    answered(spec, inputs),
    '',
    'Fill every field of the output schema.',
  ].join('\n')

const complete = (result: ToolRunResult) =>
  result.summary.trim().length > 0 && result.sections.every((section) => section.items.some((item) => item.trim()))

const context = (input: Omit<DraftInput, 'template'>) =>
  [
    `Lead: ${input.lead.name ?? 'unknown'} (${input.lead.handle ?? 'no handle'})`,
    `Channel: ${input.lead.source} · Locale: ${input.lead.locale}`,
    `Score: ${input.lead.score} · Route: ${input.route} · Stage: ${input.lead.stage}`,
    'Recent messages:',
    ...input.recentMessages.slice(-6).map((m) => `${m.direction === 'in' ? 'Lead' : 'Us'}: ${m.body}`),
  ].join('\n')

/**
 * Opt-in: only selected when ANTHROPIC_API_KEY is set. Any failure falls back to
 * the template adapter rather than dropping the lead's step on the floor.
 */
export const claudeAi: AiAdapter = {
  name: 'claude',
  live: true,

  async draft(input: DraftInput) {
    try {
      const response = await client().messages.create({
        model: env.anthropicModel,
        max_tokens: 1000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: `${context(input)}\n\nWrite the "${input.template}" step of the ${input.route} sequence.`,
          },
        ],
      })
      const text = response.content.find((block) => block.type === 'text')
      if (text?.type === 'text' && text.text.trim()) return text.text.trim()
    } catch (error) {
      console.warn('[ai] draft fell back to templates:', (error as Error).message)
    }
    return templateAi.draft(input)
  },

  async coach({ messages, locale, context }: CoachInput) {
    try {
      const response = await client().messages.create({
        model: env.anthropicModel,
        max_tokens: 2000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: COACH_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content:
              `Locale: ${locale}. The user is on level ${context.levelId} of 7, ` +
              `${context.percent}% through overall` +
              (context.headline ? `, and describes their business as "${context.headline}".` : '.'),
          },
          { role: 'assistant', content: 'Understood — I will answer in that locale and at that level.' },
          ...messages,
        ],
      })
      const text = response.content.find((block) => block.type === 'text')
      if (text?.type === 'text' && text.text.trim()) return text.text.trim()
    } catch (error) {
      console.warn('[ai] coach fell back to rules:', (error as Error).message)
    }
    return templateAi.coach({ messages, locale, context })
  },

  async runTool(input: ToolRunInput): Promise<ToolRunResult> {
    const { spec } = input
    try {
      const response = await client().messages.parse({
        model: env.anthropicModel,
        max_tokens: 4000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: TOOL_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: toolPrompt(input) }],
        output_config: { format: zodOutputFormat(toolSchema(spec)) },
      })
      const parsed = response.parsed_output as Record<string, unknown> | null | undefined
      if (parsed) {
        const result: ToolRunResult = {
          toolId: spec.id,
          summary: String(parsed.summary ?? '').trim(),
          sections: spec.sections.map((section) => {
            const value = parsed[section.id]
            const items =
              section.kind === 'text'
                ? [String(value ?? '')]
                : Array.isArray(value)
                  ? value.map((item) => String(item))
                  : []
            return { id: section.id, kind: section.kind, items: items.map((item) => item.trim()).filter(Boolean) }
          }),
          producedBy: 'claude',
        }
        if (complete(result)) return result
      }
      console.warn(`[ai] tool "${spec.id}" came back incomplete; using templates`)
    } catch (error) {
      console.warn('[ai] tool run fell back to templates:', (error as Error).message)
    }
    return templateAi.runTool(input)
  },

  async nextBestAction(input): Promise<NextBestAction> {
    try {
      const response = await client().messages.parse({
        model: env.anthropicModel,
        max_tokens: 1000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `${context(input)}\n\nPick the next best action.` }],
        output_config: { format: zodOutputFormat(NextBestActionSchema) },
      })
      if (response.parsed_output) return response.parsed_output
    } catch (error) {
      console.warn('[ai] next-best-action fell back to rules:', (error as Error).message)
    }
    return templateAi.nextBestAction(input)
  },
}
