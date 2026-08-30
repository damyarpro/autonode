/**
 * Runs one in-app AI tool: check what the user typed against the spec, ask the
 * AI adapter, and fall back to the deterministic template when anything is
 * missing or the call fails. Nothing here throws.
 */
import { ai } from '../adapters/registry.ts'
import { templateRun, type Locale } from './templates.ts'
import type { AiToolSpec, ToolRunResult, ToolRunSection } from '../../shared/aiToolSpecs.ts'

export type { Locale }

export type ValidationResult =
  | { ok: true; inputs: Record<string, string> }
  | { ok: false; errors: string[] }

/**
 * Pure. Errors are `field:code` so the client can render them bilingually from
 * the same spec it used to draw the form.
 */
export function validateInputs(spec: AiToolSpec, raw: unknown): ValidationResult {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const errors: string[] = []
  const inputs: Record<string, string> = {}

  for (const field of spec.fields) {
    const value = source[field.id]

    if (value !== undefined && value !== null && typeof value !== 'string') {
      errors.push(`${field.id}:not_text`)
      continue
    }

    const text = typeof value === 'string' ? value.trim() : ''

    if (text === '') {
      // Unknown keys never reach `inputs`, and neither does a blank optional
      // field — the templates read absence as "the user skipped this".
      if (field.required) errors.push(`${field.id}:required`)
      continue
    }

    if (field.maxLength !== undefined && text.length > field.maxLength) {
      errors.push(`${field.id}:too_long:${field.maxLength}`)
      continue
    }

    if (field.type === 'select') {
      const allowed = field.options ?? []
      if (!allowed.some((option) => option.value === text)) {
        errors.push(`${field.id}:not_an_option`)
        continue
      }
    }

    inputs[field.id] = text
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, inputs }
}

/** A section is usable only when it carries at least one non-empty entry. */
const usable = (spec: AiToolSpec, result: ToolRunResult): boolean => {
  if (!result.summary.trim()) return false
  if (result.sections.length !== spec.sections.length) return false
  return spec.sections.every((section) => {
    const answer = result.sections.find((candidate) => candidate.id === section.id)
    return answer !== undefined && answer.items.some((item) => item.trim().length > 0)
  })
}

/** Trims, drops blanks, and collapses a `text` section back to one entry. */
const tidy = (spec: AiToolSpec, result: ToolRunResult): ToolRunResult => ({
  toolId: spec.id,
  summary: result.summary.trim(),
  producedBy: result.producedBy,
  sections: spec.sections.map((section): ToolRunSection => {
    const items = (result.sections.find((candidate) => candidate.id === section.id)?.items ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
    return { id: section.id, kind: section.kind, items: section.kind === 'text' ? [items.join(' ')] : items }
  }),
})

/**
 * Never throws and never returns a half-filled answer: an adapter that fails or
 * comes back short is replaced by the template, which always answers.
 */
export async function runTool(
  spec: AiToolSpec,
  inputs: Record<string, string>,
  locale: Locale = 'fa',
): Promise<ToolRunResult> {
  try {
    const answer = tidy(spec, await ai().runTool({ spec, inputs, locale }))
    if (usable(spec, answer)) return answer
    console.warn(`[tools] "${spec.id}" answer was incomplete; using the template`)
  } catch (error) {
    console.warn(`[tools] "${spec.id}" fell back to the template:`, (error as Error).message)
  }
  return templateRun(spec, inputs, locale)
}
