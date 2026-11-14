import { expect, test } from "bun:test"
import { z } from "zod"

import { enums, eventJson, eventSchemas } from "@leafage/core"

import { signIn } from "./session"

const canon = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
        )
      : v

const { core } = await signIn()

test("generated event payloads still match event_schema()", async () => {
  for (const type of enums.event_type) {
    const live = canon(await core.event_schema({ t: type }))
    expect(canon(eventJson[type])).toEqual(live)
    const { $schema: _, ...emitted } = z.toJSONSchema(eventSchemas[type]) as Record<string, unknown>
    expect(canon(emitted)).toEqual(live)
  }
})
