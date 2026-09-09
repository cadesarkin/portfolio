import { Redis } from "@upstash/redis"

/**
 * Upstash Redis client.
 *
 * Built lazily rather than at module load. Next evaluates top-level module code
 * during `next build`, and a client constructed there throws when the env vars
 * are absent — which breaks the build on any checkout that has not run
 * `vercel env pull`.
 *
 * The Marketplace integration provisions these as KV_REST_API_* rather than the
 * UPSTASH_REDIS_REST_* names `Redis.fromEnv()` expects, so they are passed
 * explicitly.
 */
let client: Redis | null = null

export function getRedis(): Redis {
  if (client) return client

  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    throw new Error("Redis is not configured: KV_REST_API_URL/TOKEN missing")
  }

  client = new Redis({ url, token })
  return client
}

/** True when the store is reachable, so routes can degrade instead of 500. */
export function redisConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}
