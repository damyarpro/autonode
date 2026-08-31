/**
 * The four channels that used to be store-only, and the promise each of them
 * makes: deliver when it really can, and name the reason when it cannot.
 *
 * `globalThis.fetch` is stubbed for every case here — no test in this file ever
 * reaches the network, and each one restores the real fetch on its way out.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { CHANNELS, type Lead } from '../../types.ts'
import type { ChannelAdapter } from '../types.ts'
import { authorUrn, linkedinChannel } from './linkedin.ts'
import { instagramChannel, mediaIn } from './instagram.ts'
import { forgetYouTubeToken, videoIn, youtubeChannel } from './youtube.ts'
import { sign, websiteChannel } from './website.ts'

/** Every variable a live channel reads, so each case starts from an empty one. */
const CHANNEL_VARS = [
  'TELEGRAM_BOT_TOKEN',
  'LINKEDIN_ACCESS_TOKEN',
  'LINKEDIN_API_BASE',
  'LINKEDIN_AUTHOR_TYPE',
  'INSTAGRAM_ACCESS_TOKEN',
  'INSTAGRAM_API_BASE',
  'INSTAGRAM_POLL_MS',
  'INSTAGRAM_POLL_ATTEMPTS',
  'YOUTUBE_ACCESS_TOKEN',
  'YOUTUBE_CLIENT_ID',
  'YOUTUBE_CLIENT_SECRET',
  'YOUTUBE_REFRESH_TOKEN',
  'WEBSITE_PUBLISH_URL',
  'WEBSITE_SIGNING_SECRET',
  'WEBHOOK_SIGNING_SECRET',
]
for (const key of CHANNEL_VARS) delete process.env[key]

// The registry reads `hasTelegram()` from `env.ts`, which reads the environment
// once at import, so it is imported only after the variables above are gone.
const { channelFor } = await import('../registry.ts')

/**
 * Id 0 is the content factory's audience stand-in — the caller these four
 * adapters are for. A real lead carries a real id, which is how a publishing
 * adapter knows it has been handed a person rather than an audience.
 */
const lead = (externalId: string | null, id = 0): Lead => ({
  id,
  source: 'website',
  external_id: externalId,
  handle: null,
  name: null,
  locale: 'fa',
  score: 0,
  route: 'cold',
  stage: 'new',
  owner: null,
  value_toman: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
})

type Recorded = { url: string; method: string; headers: Record<string, string>; body: string }

/** Installs a stub, runs the case, and always puts the real fetch back. */
async function withFetch(
  reply: (call: Recorded) => Response | Promise<Response>,
  run: (calls: Recorded[]) => Promise<void>,
): Promise<void> {
  const real = globalThis.fetch
  const calls: Recorded[] = []

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries((init?.headers ?? {}) as Record<string, string>)) {
      headers[key.toLowerCase()] = value
    }
    const call: Recorded = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers,
      body: typeof init?.body === 'string' ? init.body : '',
    }
    calls.push(call)
    return reply(call)
  }) as typeof fetch

  try {
    await run(calls)
  } finally {
    globalThis.fetch = real
  }
}

/** What `send` really answers: the reason the interface's return type omits. */
const send = async (adapter: ChannelAdapter, target: string | null, body: string, leadId = 0) =>
  (await adapter.send(lead(target, leadId), body)) as { status: string; externalId?: string; reason?: string }

const withEnv = async (vars: Record<string, string>, run: () => Promise<void>) => {
  Object.assign(process.env, vars)
  try {
    await run()
  } finally {
    for (const key of Object.keys(vars)) delete process.env[key]
  }
}

// ── the empty environment ────────────────────────────────────────────────

test('with no credentials every channel records the message and delivers nothing', async () => {
  await withFetch(
    () => {
      throw new Error('a store-only channel must not call anything')
    },
    async (calls) => {
      for (const channel of CHANNELS) {
        const adapter = channelFor(channel)
        assert.equal(adapter.channel, channel)
        assert.equal(adapter.live, false, `${channel} should be store-only with no credentials`)
        const result = await adapter.send(lead('anywhere'), 'سلام')
        // The funnel still advances: the message is recorded, not lost.
        assert.equal(result.status, 'simulated')
      }
      assert.equal(calls.length, 0)
    },
  )
})

test('credentials put the real adapter behind each channel, and only that one', async () => {
  await withEnv({ LINKEDIN_ACCESS_TOKEN: 'li-token' }, async () => {
    assert.equal(channelFor('linkedin'), linkedinChannel)
    assert.equal(channelFor('instagram').live, false)
  })
  await withEnv({ INSTAGRAM_ACCESS_TOKEN: 'ig-token' }, async () => {
    assert.equal(channelFor('instagram'), instagramChannel)
    assert.equal(channelFor('linkedin').live, false)
  })
  await withEnv({ YOUTUBE_ACCESS_TOKEN: 'yt-token' }, async () => {
    assert.equal(channelFor('youtube'), youtubeChannel)
  })
  await withEnv({ YOUTUBE_CLIENT_ID: 'a', YOUTUBE_CLIENT_SECRET: 'b', YOUTUBE_REFRESH_TOKEN: 'c' }, async () => {
    assert.equal(channelFor('youtube'), youtubeChannel)
  })
  await withEnv({ WEBSITE_PUBLISH_URL: 'https://example.com/hook' }, async () => {
    assert.equal(channelFor('website'), websiteChannel)
  })

  // And back to store-only once the environment is empty again.
  for (const channel of CHANNELS) assert.equal(channelFor(channel).live, false)
})

test('a publishing channel refuses to put one lead\'s message on a public feed', async () => {
  await withEnv(
    {
      LINKEDIN_ACCESS_TOKEN: 'li-token',
      INSTAGRAM_ACCESS_TOKEN: 'ig-token',
      YOUTUBE_ACCESS_TOKEN: 'yt-token',
      WEBSITE_PUBLISH_URL: 'https://example.com/hook',
    },
    async () => {
      await withFetch(
        () => {
          throw new Error('a private message must never reach a publishing API')
        },
        async (calls) => {
          // The nurture pass and the reminder pass address a real lead. None of
          // these four APIs can message a person, so each says so instead of
          // publishing what was written for one reader.
          for (const adapter of [linkedinChannel, instagramChannel, youtubeChannel, websiteChannel]) {
            const result = await send(adapter, 'somewhere', 'سلام سارا، دیروز درباره‌ی قیمت پرسیدی', 7)
            assert.equal(result.status, 'failed')
            assert.equal(result.reason, `${adapter.channel}:no_direct_message`)
          }
          assert.equal(calls.length, 0)
        },
      )
    },
  )
})

// ── LinkedIn ─────────────────────────────────────────────────────────────

test('a bare target becomes an organization URN, a written URN is left alone', () => {
  assert.equal(authorUrn('123456'), 'urn:li:organization:123456')
  assert.equal(authorUrn('urn:li:person:abc'), 'urn:li:person:abc')
  assert.equal(authorUrn(' '), null)
  assert.equal(authorUrn(null), null)
})

test('linkedin publishes text and keeps the post URN', async () => {
  await withEnv({ LINKEDIN_ACCESS_TOKEN: 'li-token' }, async () => {
    await withFetch(
      () => new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:7' } }),
      async (calls) => {
        const result = await send(linkedinChannel, '123456', 'یک پست واقعی')
        assert.equal(result.status, 'sent')
        assert.equal(result.externalId, 'urn:li:share:7')

        assert.equal(calls.length, 1)
        assert.match(calls[0].url, /\/rest\/posts$/)
        assert.equal(calls[0].headers.authorization, 'Bearer li-token')
        const body = JSON.parse(calls[0].body) as { author: string; commentary: string }
        assert.equal(body.author, 'urn:li:organization:123456')
        assert.equal(body.commentary, 'یک پست واقعی')
      },
    )
  })
})

test('linkedin without a target never calls the API', async () => {
  await withEnv({ LINKEDIN_ACCESS_TOKEN: 'li-token' }, async () => {
    await withFetch(
      () => new Response(null, { status: 201 }),
      async (calls) => {
        const result = await send(linkedinChannel, null, 'hello')
        assert.equal(result.status, 'failed')
        assert.equal(result.reason, 'linkedin:needs_target')
        assert.equal(calls.length, 0)
      },
    )
  })
})

test('a linkedin 401 fails without throwing', async () => {
  await withEnv({ LINKEDIN_ACCESS_TOKEN: 'stale' }, async () => {
    await withFetch(
      () => new Response('{"message":"expired"}', { status: 401 }),
      async () => {
        const result = await send(linkedinChannel, '123456', 'hello')
        assert.equal(result.status, 'failed')
        assert.equal(result.reason, 'linkedin:rejected')
      },
    )
  })
})

test('a dead linkedin fails without throwing', async () => {
  await withEnv({ LINKEDIN_ACCESS_TOKEN: 'li-token' }, async () => {
    await withFetch(
      () => {
        throw new Error('ECONNRESET')
      },
      async () => {
        const result = await send(linkedinChannel, '123456', 'hello')
        assert.equal(result.status, 'failed')
        assert.equal(result.reason, 'linkedin:unreachable')
      },
    )
  })
})

// ── Instagram ────────────────────────────────────────────────────────────

test('a media link is found in a body, and prose alone has none', () => {
  assert.deepEqual(mediaIn('ببینید https://cdn.example.com/a/post.jpg خوب است'), {
    url: 'https://cdn.example.com/a/post.jpg',
    kind: 'image',
  })
  assert.deepEqual(mediaIn('the reel: https://cdn.example.com/reel.mp4.'), {
    url: 'https://cdn.example.com/reel.mp4',
    kind: 'video',
  })
  assert.equal(mediaIn('read more at https://example.com/blog/post'), null)
  assert.equal(mediaIn('سه دلیل برای شروع امروز'), null)
})

test('instagram refuses a text-only piece by name, and calls nothing', async () => {
  await withEnv({ INSTAGRAM_ACCESS_TOKEN: 'ig-token' }, async () => {
    await withFetch(
      () => new Response('{"id":"1"}', { status: 200 }),
      async (calls) => {
        const result = await send(instagramChannel, '17841400000000000', 'سه دلیل برای شروع امروز')
        assert.equal(result.status, 'failed')
        assert.equal(result.reason, 'instagram:needs_media')
        // The honest part: nothing was attempted, so nothing can look delivered.
        assert.equal(calls.length, 0)
      },
    )
  })
})

test('instagram publishes an image in two steps and keeps the published id', async () => {
  await withEnv({ INSTAGRAM_ACCESS_TOKEN: 'ig-token' }, async () => {
    await withFetch(
      (call) =>
        call.url.includes('/media_publish')
          ? new Response('{"id":"post-9"}', { status: 200 })
          : new Response('{"id":"container-4"}', { status: 200 }),
      async (calls) => {
        const result = await send(instagramChannel, '17841400000000000', 'عکس امروز https://cdn.example.com/a.jpg')
        assert.equal(result.status, 'sent')
        assert.equal(result.externalId, 'post-9')

        assert.equal(calls.length, 2)
        const container = new URLSearchParams(calls[0].body)
        assert.equal(container.get('image_url'), 'https://cdn.example.com/a.jpg')
        assert.equal(container.get('caption'), 'عکس امروز')
        assert.equal(container.get('access_token'), 'ig-token')
        assert.equal(new URLSearchParams(calls[1].body).get('creation_id'), 'container-4')
      },
    )
  })
})

test('instagram waits for a video container and reports one that never finishes', async () => {
  await withEnv(
    { INSTAGRAM_ACCESS_TOKEN: 'ig-token', INSTAGRAM_POLL_MS: '0', INSTAGRAM_POLL_ATTEMPTS: '2' },
    async () => {
      await withFetch(
        (call) =>
          call.url.includes('status_code')
            ? new Response('{"status_code":"IN_PROGRESS"}', { status: 200 })
            : new Response('{"id":"container-4"}', { status: 200 }),
        async (calls) => {
          const result = await send(instagramChannel, '17841400000000000', 'ریلز https://cdn.example.com/r.mp4')
          assert.equal(result.status, 'failed')
          assert.equal(result.reason, 'instagram:not_ready')
          // One container, two polls, and no publish call.
          assert.equal(calls.length, 3)
          assert.ok(!calls.some((call) => call.url.includes('/media_publish')))
        },
      )
    },
  )
})

test('an instagram 401 and a dead instagram both fail without throwing', async () => {
  await withEnv({ INSTAGRAM_ACCESS_TOKEN: 'stale' }, async () => {
    await withFetch(
      () => new Response('{"error":{}}', { status: 401 }),
      async () => {
        const refused = await send(instagramChannel, '178414', 'x https://cdn.example.com/a.jpg')
        assert.equal(refused.status, 'failed')
        assert.equal(refused.reason, 'instagram:rejected')
      },
    )
    await withFetch(
      () => {
        throw new Error('ENOTFOUND')
      },
      async () => {
        const dead = await send(instagramChannel, '178414', 'x https://cdn.example.com/a.jpg')
        assert.equal(dead.status, 'failed')
        assert.equal(dead.reason, 'instagram:unreachable')
      },
    )
  })
})

// ── YouTube ──────────────────────────────────────────────────────────────

test('a video link is found in a body, and a script has none', () => {
  assert.equal(videoIn('render: https://cdn.example.com/ad.mp4'), 'https://cdn.example.com/ad.mp4')
  assert.equal(videoIn('https://cdn.example.com/a.jpg'), null)
  assert.equal(videoIn('صحنه‌ی اول: نمای باز از کارگاه'), null)
})

test('youtube refuses a script by name, and calls nothing', async () => {
  forgetYouTubeToken()
  await withEnv({ YOUTUBE_ACCESS_TOKEN: 'yt-token' }, async () => {
    await withFetch(
      () => new Response('{}', { status: 200 }),
      async (calls) => {
        const result = await send(youtubeChannel, 'UC123', 'صحنه‌ی اول: نمای باز از کارگاه')
        assert.equal(result.status, 'failed')
        assert.equal(result.reason, 'youtube:needs_video')
        assert.equal(calls.length, 0)
      },
    )
  })
})

test('youtube uploads a real file and keeps the video id', async () => {
  forgetYouTubeToken()
  await withEnv({ YOUTUBE_ACCESS_TOKEN: 'yt-token' }, async () => {
    await withFetch(
      (call) => {
        if (call.url.endsWith('/ad.mp4')) {
          return new Response(new Uint8Array([0, 1, 2, 3]), { headers: { 'content-type': 'video/mp4' } })
        }
        if (call.method === 'POST') {
          return new Response('{}', { status: 200, headers: { location: 'https://upload.example.com/session/1' } })
        }
        return new Response('{"id":"vid-77"}', { status: 200 })
      },
      async (calls) => {
        const result = await send(youtubeChannel, 'UC123', 'آگهی تازه\nمتن کامل https://cdn.example.com/ad.mp4')
        assert.equal(result.status, 'sent')
        assert.equal(result.externalId, 'vid-77')

        assert.equal(calls.length, 3)
        const session = JSON.parse(calls[1].body) as {
          snippet: { title: string }
          status: { privacyStatus: string }
        }
        assert.equal(session.snippet.title, 'آگهی تازه')
        // Nothing goes public by accident.
        assert.equal(session.status.privacyStatus, 'private')
        assert.equal(calls[2].method, 'PUT')
        assert.equal(calls[2].url, 'https://upload.example.com/session/1')
      },
    )
  })
})

test('youtube trades a refresh token for an access token before uploading', async () => {
  forgetYouTubeToken()
  await withEnv(
    { YOUTUBE_CLIENT_ID: 'id', YOUTUBE_CLIENT_SECRET: 'secret', YOUTUBE_REFRESH_TOKEN: 'refresh' },
    async () => {
      await withFetch(
        (call) => {
          if (call.url.includes('oauth2')) {
            return new Response('{"access_token":"fresh","expires_in":3600}', { status: 200 })
          }
          if (call.url.endsWith('/ad.mp4')) return new Response(new Uint8Array([9]))
          if (call.method === 'POST') {
            return new Response('{}', { status: 200, headers: { location: 'https://upload.example.com/s' } })
          }
          return new Response('{"id":"vid-1"}', { status: 200 })
        },
        async (calls) => {
          const result = await send(youtubeChannel, 'UC123', 'title\nhttps://cdn.example.com/ad.mp4')
          assert.equal(result.status, 'sent')
          assert.ok(calls[0].url.includes('oauth2'))
          assert.equal(calls[2].headers.authorization, 'Bearer fresh')
        },
      )
    },
  )
  forgetYouTubeToken()
})

test('a youtube 401 and a dead youtube both fail without throwing', async () => {
  forgetYouTubeToken()
  await withEnv({ YOUTUBE_ACCESS_TOKEN: 'stale' }, async () => {
    await withFetch(
      (call) =>
        call.url.endsWith('/ad.mp4')
          ? new Response(new Uint8Array([1]))
          : new Response('{"error":{}}', { status: 401 }),
      async () => {
        const refused = await send(youtubeChannel, 'UC123', 'title\nhttps://cdn.example.com/ad.mp4')
        assert.equal(refused.status, 'failed')
        assert.equal(refused.reason, 'youtube:rejected')
      },
    )
    await withFetch(
      () => {
        throw new Error('ECONNRESET')
      },
      async () => {
        const dead = await send(youtubeChannel, 'UC123', 'title\nhttps://cdn.example.com/ad.mp4')
        assert.equal(dead.status, 'failed')
        assert.equal(dead.reason, 'youtube:unreachable')
      },
    )
  })
  forgetYouTubeToken()
})

// ── Website ──────────────────────────────────────────────────────────────

test('the website POST carries the signature the inbound webhook would verify', async () => {
  const secret = 'shared-secret'
  await withEnv({ WEBSITE_PUBLISH_URL: 'https://example.com/hook', WEBSITE_SIGNING_SECRET: secret }, async () => {
    await withFetch(
      () => new Response('{"id":"page-3"}', { status: 200 }),
      async (calls) => {
        const result = await send(websiteChannel, 'https://example.com/blog', 'نوشته‌ی تازه')
        assert.equal(result.status, 'sent')
        assert.equal(result.externalId, 'page-3')
        assert.equal(calls.length, 1)

        const raw = calls[0].body
        // Exactly what `signatureMatches` in server/routes/webhooks.ts computes.
        const expected = createHmac('sha256', secret).update(raw).digest('hex')
        assert.equal(calls[0].headers['x-signature'], expected)
        assert.equal(sign(raw, secret), expected)

        // That route verifies over `JSON.stringify(request.body)`, so the body
        // has to survive a parse and a re-serialise byte for byte.
        assert.equal(JSON.stringify(JSON.parse(raw)), raw)

        const payload = JSON.parse(raw) as { channel: string; target: string; body: string }
        assert.equal(payload.channel, 'website')
        assert.equal(payload.target, 'https://example.com/blog')
        assert.equal(payload.body, 'نوشته‌ی تازه')
      },
    )
  })
})

test('the website endpoint falls back to the inbound signing secret', async () => {
  await withEnv({ WEBSITE_PUBLISH_URL: 'https://example.com/hook', WEBHOOK_SIGNING_SECRET: 'inbound' }, async () => {
    await withFetch(
      () => new Response(null, { status: 204 }),
      async (calls) => {
        const result = await send(websiteChannel, 'https://example.com/blog', 'x')
        assert.equal(result.status, 'sent')
        assert.equal(result.externalId, undefined)
        assert.equal(calls[0].headers['x-signature'], sign(calls[0].body, 'inbound'))
      },
    )
  })
})

test('with no secret the website POST still goes, unsigned, exactly as the inbound hook allows', async () => {
  await withEnv({ WEBSITE_PUBLISH_URL: 'https://example.com/hook' }, async () => {
    await withFetch(
      () => new Response('{}', { status: 200 }),
      async (calls) => {
        const result = await send(websiteChannel, 'https://example.com/blog', 'x')
        assert.equal(result.status, 'sent')
        assert.equal(calls[0].headers['x-signature'], undefined)
      },
    )
  })
})

test('a website 401 and a dead endpoint both fail without throwing', async () => {
  await withEnv({ WEBSITE_PUBLISH_URL: 'https://example.com/hook' }, async () => {
    await withFetch(
      () => new Response('nope', { status: 401 }),
      async () => {
        const refused = await send(websiteChannel, 'https://example.com/blog', 'x')
        assert.equal(refused.status, 'failed')
        assert.equal(refused.reason, 'website:rejected')
      },
    )
    await withFetch(
      () => {
        throw new Error('ECONNREFUSED')
      },
      async () => {
        const dead = await send(websiteChannel, 'https://example.com/blog', 'x')
        assert.equal(dead.status, 'failed')
        assert.equal(dead.reason, 'website:unreachable')
      },
    )
  })
})
