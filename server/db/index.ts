import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../env.ts'

const here = dirname(fileURLToPath(import.meta.url))

let instance: DatabaseSync | null = null

/**
 * `node:sqlite` ships with Node, so the whole system runs with no native build
 * and no database service. Everything goes through this module, so swapping in
 * better-sqlite3 later is a one-file change.
 */
export function db(): DatabaseSync {
  if (instance) return instance
  instance = open(env.dbFile)
  return instance
}

export function open(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const handle = new DatabaseSync(file)
  handle.exec(readFileSync(join(here, 'schema.sql'), 'utf8'))
  return handle
}

/** Used by tests to run against a throwaway in-memory database. */
export function useDatabase(handle: DatabaseSync): void {
  instance = handle
}

export function closeDatabase(): void {
  instance?.close()
  instance = null
}
