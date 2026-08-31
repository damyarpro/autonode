import type { Bi } from './aiToolSpecs.ts'

/**
 * The contract between the chat agent's server half and the page that shows it,
 * plus the shape of a tool wherever it came from (rule 10).
 *
 * There are three MCP surfaces in this project and they are easy to confuse:
 *
 *   inbound   an external assistant connects to *our* MCP server (mcp/) and
 *             drives this app: boards, nodes, reports, the business profile.
 *   outbound  this app connects to *someone else's* MCP server and calls their
 *             tools. `origin: 'mcp'` marks a tool that arrived this way.
 *   internal  the app's own capabilities, exposed to the agent directly over
 *             the HTTP API it already has. No MCP hop, because there is no
 *             process boundary to cross.
 *
 * The agent is the thing that sees all three as one list of tools.
 */

export type { Bi }

export type ToolOrigin = 'internal' | 'mcp'

export type AgentTool = {
  /** `boards.list`, or `mcp:<server>:<tool>` for an outbound one. */
  name: string
  origin: ToolOrigin
  /** The external MCP server this came from, when `origin` is `mcp`. */
  server?: string
  title: Bi
  /**
   * Written for the model, in English. This is not user-facing prose — the
   * page shows `title`, which is bilingual (rules 2 and 11).
   */
  description: string
  /** JSON Schema for the arguments, handed to the model as-is. */
  schema: Record<string, unknown>
  /** True when calling it changes something, so the page can say so first. */
  writes: boolean
}

/** One thing that happened during a turn, in the order it happened. */
export type AgentStep =
  | { kind: 'said'; text: string }
  | {
      kind: 'called'
      tool: string
      origin: ToolOrigin
      args: unknown
      ok: boolean
      /** The tool's own answer, or its failure. Never invented. */
      result: string
      ms: number
    }

/**
 * `claude` means the model chose the tools. `router` is the no-key path: it can
 * still run a tool the person named outright, and says so rather than implying
 * it reasoned (rules 4 and 5).
 */
export type AgentProducedBy = 'claude' | 'router'

export type AgentTurn = {
  id: number
  question: string
  steps: AgentStep[]
  answer: string
  producedBy: AgentProducedBy
  at: string
}

export const AGENT_LIMITS = {
  question: 2000,
  /** How many tool calls one turn may make before it has to answer. */
  steps: 8,
  /** Characters of a tool result handed back to the model. */
  result: 4000,
} as const

/** An external MCP server this app dials out to. */
export type McpServerStatus = {
  name: string
  /** `stdio` runs a command; `http` connects to a URL. */
  transport: 'stdio' | 'http'
  connected: boolean
  toolCount: number
  /** Why it is not connected, as a code the client translates. */
  error?: string
}
