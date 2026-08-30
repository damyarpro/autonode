import { EventEmitter } from 'node:events'
import type { DomainEvent } from './types.ts'

/**
 * In-process bus. Every meaningful state change publishes here; the SSE route
 * fans it out to the canvas so a real lead lights up a real edge.
 */
const bus = new EventEmitter()
bus.setMaxListeners(0)

const recent: DomainEvent[] = []
const RECENT_LIMIT = 100

export function publish(event: Omit<DomainEvent, 'at'> & { at?: string }): DomainEvent {
  const full: DomainEvent = { ...event, at: event.at ?? new Date().toISOString() }
  recent.push(full)
  if (recent.length > RECENT_LIMIT) recent.shift()
  bus.emit('event', full)
  return full
}

export function subscribe(listener: (event: DomainEvent) => void): () => void {
  bus.on('event', listener)
  return () => bus.off('event', listener)
}

export const recentEvents = (): DomainEvent[] => [...recent]
