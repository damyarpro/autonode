import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
import { env } from '../../env.ts'
import { businessBrief } from '../../domain/business.ts'
import type { ContentAngle, ContentKind } from '../../domain/content.ts'
import { getBusiness } from '../../db/queries.ts'
import { templateAi } from './template.ts'
import { briefIsComplete } from '../../domain/booking.ts'
import type {
  AiAdapter,
  CallBrief,
  CallBriefInput,
  CoachInput,
  ContentWriteInput,
  DraftInput,
  NextBestAction,
  ToolRunInput,
} from '../types.ts'
import type { AiToolSpec, ToolRunResult } from '../../../shared/aiToolSpecs.ts'

const CallBriefSchema = z.object({
  opening: z
    .string()
    .describe('The first two sentences of the call, naming the lead and what they already did.'),
  objections: z
    .array(
      z.object({
        objection: z.string().describe("The doubt, in the lead's own likely words."),
        answer: z.string().describe('How the caller answers it, in one or two sentences.'),
      }),
    )
    .describe('Exactly the two objections this lead is most likely to raise.'),
  ask: z.string().describe('The single, exact thing to ask for before hanging up.'),
})

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

const CALL_SYSTEM = `You brief a solo founder right before they phone one of their own leads.
You get the lead's real event history; use it and nothing else. Answer in the lead's
locale exactly — fa means Persian, en means English. Never invent facts, results or
numbers about the lead or the business, and never promise income. Give exactly two
objections, the two this history makes most likely, phrased the way the lead would say
them. The ask is one concrete request, not a summary. No markdown, no headings.`

const COACH_SYSTEM = `You are the Autonode coach: a direct, practical business
mentor for solo founders building an AI-assisted business. Answer in the user's
locale — fa means Persian, en means English. Be concrete and short: name the next
action, not a lecture. Never invent numbers about the user's business, and never
promise income. The learning path has seven levels: choose the idea, build the
first sellable version, build a trusted brand, build the audience machine, build
the online sales infrastructure, build the funnel that earns, full automation.`

const TOOL_SYSTEM = `You run the in-app AI tools of Autonode (موج ابزار), a Persian-first app
for solo founders building an AI-assisted business. Each tool takes what the founder
typed and returns one structured answer.
Rules: answer in the caller's locale exactly — fa means Persian, en means English.
Be concrete and specific to what they wrote, and reuse their own words for their
business, audience and skills. Never invent facts, numbers, revenue or results about
them, and never promise income. One action or one idea per entry; no preamble, no
markdown, no headings inside an entry. Every list or steps block needs at least three
entries; every text block is one short paragraph.`

const CONTENT_SYSTEM = `You write the content a solo founder publishes for their own business.
Answer in the caller's locale exactly — fa means Persian, en means English. Every piece
is about the offer described in the business brief and nobody else's: reuse the owner's
own words for what they sell and who they sell to. Never invent a result, a number, a
customer, a testimonial or a deadline they did not give you, and never promise income.
One piece per request, in the order asked, ready to publish as it stands — no preamble,
no markdown headings, no placeholders for the owner to fill in.`

const ContentSchema = z.object({
  pieces: z
    .array(
      z.object({
        title: z.string().describe('Short internal name for this piece, so the owner can find it in a list.'),
        body: z.string().describe('The piece itself, ready to publish exactly as written.'),
      }),
    )
    .describe('Exactly one entry per requested piece, in the same order as the numbered list.'),
})

const KIND_BRIEF: Record<ContentKind, string> = {
  copy: 'a publish-ready post: one hook line, one short body, one call to action',
  video: 'a short-video script with timed beats — hook, body, call to action — plus a one-line delivery note',
  voice: 'a voiceover script of about thirty seconds, with the pauses marked',
}

const ANGLE_BRIEF: Record<ContentAngle, string> = {
  problem: 'name the job the offer takes off the audience\u2019s plate, without claiming a result',
  offer: 'state plainly what is sold, to whom, and what happens next',
  objection: 'answer the "is now the right time" doubt honestly, including when the answer is no',
  start: 'show how small the first step is and what to say in it',
  question: 'ask the audience one real question and invite the reply',
}

const contentPrompt = ({ briefs, locale }: ContentWriteInput) =>
  [
    `Locale: ${locale}`,
    `Write ${briefs.length} piece(s), numbered, in this exact order:`,
    ...briefs.map(
      (brief, index) =>
        `${index + 1}. channel ${brief.channel} \u00b7 ${KIND_BRIEF[brief.kind]} \u00b7 angle: ${ANGLE_BRIEF[brief.angle]}`,
    ),
    '',
    'Each entry gets its own title and body. Fill every field of the output schema.',
  ].join('\n')

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

/** The lead's own log, oldest first, is the whole evidence base for the brief. */
const callPrompt = (input: CallBriefInput) =>
  [
    `Lead: ${input.lead.name ?? 'unknown'} (${input.lead.handle ?? 'no handle'})`,
    `Channel: ${input.lead.source} · Locale: ${input.locale}`,
    `Score: ${input.lead.score} · Route: ${input.lead.route} · Stage: ${input.lead.stage}`,
    '',
    'Their history, oldest first:',
    ...input.events.slice(-20).map((event) => `${event.at} ${event.type}`),
    '',
    'Recent messages:',
    ...input.recentMessages.slice(-6).map((m) => `${m.direction === 'in' ? 'Lead' : 'Us'}: ${m.body}`),
    '',
    'Write the opening, the two objections with answers, and the ask.',
  ].join('\n')

const complete = (result: ToolRunResult) =>
  result.summary.trim().length > 0 && result.sections.every((section) => section.items.some((item) => item.trim()))

/**
 * The owner's own business, prepended to every call. It goes in the first user
 * message rather than the system prompt so the cached system prefix stays
 * stable when they edit their profile.
 */
const withBusiness = (locale: string, body: string) => `${businessBrief(getBusiness(), locale)}\n\n${body}`

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
            content: withBusiness(
              input.lead.locale,
              `${context(input)}\n\nWrite the "${input.template}" step of the ${input.route} sequence.`,
            ),
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
              `${businessBrief(getBusiness(), locale)}\n\n` +
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
        messages: [{ role: 'user', content: withBusiness(input.locale, toolPrompt(input)) }],
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

  /**
   * One batch of publishable content. A short or blank answer is discarded
   * whole rather than blended with the templates, so the plan's producedBy flag
   * stays truthful.
   */
  async writeContent(input: ContentWriteInput) {
    try {
      const response = await client().messages.parse({
        model: env.anthropicModel,
        max_tokens: 6000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: CONTENT_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [
          {
            role: 'user',
            content: `${businessBrief(input.business, input.locale)}\n\n${contentPrompt(input)}`,
          },
        ],
        output_config: { format: zodOutputFormat(ContentSchema) },
      })
      const pieces = response.parsed_output?.pieces ?? []
      const written = pieces.map((piece) => ({ title: piece.title.trim(), body: piece.body.trim() }))
      if (written.length === input.briefs.length && written.every((piece) => piece.title && piece.body)) {
        return written
      }
      console.warn('[ai] content came back incomplete; using templates')
    } catch (error) {
      console.warn('[ai] content fell back to templates:', (error as Error).message)
    }
    return templateAi.writeContent(input)
  },

  async callBrief(input: CallBriefInput): Promise<CallBrief> {
    try {
      const response = await client().messages.parse({
        model: env.anthropicModel,
        max_tokens: 2000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: CALL_SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: withBusiness(input.locale, callPrompt(input)) }],
        output_config: { format: zodOutputFormat(CallBriefSchema) },
      })
      const parsed = response.parsed_output
      if (parsed) {
        const brief: CallBrief = {
          opening: parsed.opening.trim(),
          objections: parsed.objections
            .slice(0, 2)
            .map((entry) => ({ objection: entry.objection.trim(), answer: entry.answer.trim() })),
          ask: parsed.ask.trim(),
          producedBy: 'claude',
        }
        // A half-written brief is dropped whole, so `producedBy` stays truthful.
        if (briefIsComplete(brief)) return brief
      }
      console.warn('[ai] call brief came back incomplete; using the composed one')
    } catch (error) {
      console.warn('[ai] call brief fell back to the composed one:', (error as Error).message)
    }
    return templateAi.callBrief(input)
  },

  async nextBestAction(input): Promise<NextBestAction> {
    try {
      const response = await client().messages.parse({
        model: env.anthropicModel,
        max_tokens: 1000,
        thinking: { type: 'adaptive' },
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        messages: [
          { role: 'user', content: withBusiness(input.lead.locale, `${context(input)}\n\nPick the next best action.`) },
        ],
        output_config: { format: zodOutputFormat(NextBestActionSchema) },
      })
      if (response.parsed_output) return response.parsed_output
    } catch (error) {
      console.warn('[ai] next-best-action fell back to rules:', (error as Error).message)
    }
    return templateAi.nextBestAction(input)
  },
}
