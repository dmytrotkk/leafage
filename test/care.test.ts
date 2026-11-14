import { afterAll, beforeAll, expect, test } from "bun:test"

import { addDays, LeafageError, type ErrorCode } from "@leafage/core"

import { signIn } from "./session"

const { db, core, uid } = await signIn()
const today = await core.local_date()
const day = (n: number) => addDays(today, n - 4)
const at = (n: number) => `${day(n)}T00:00:00Z`
const iso = (s: string | null) => (s ? new Date(s).toISOString() : null)
const TENANT = ["plants", "pots", "events", "pest_case", "feed_override", "tasks", "substrate", "supplement"] as const

async function rows(table: (typeof TENANT)[number]): Promise<number> {
  const { count } = await db.from(table).select("*", { count: "exact", head: true }).eq("owner_id", uid).throwOnError()
  return count!
}

async function fails(p: Promise<unknown>, code: ErrorCode, detail?: Record<string, unknown>) {
  try {
    await p
  } catch (e) {
    expect(e).toBeInstanceOf(LeafageError)
    const err = e as LeafageError
    expect(err.code).toBe(code)
    if (detail) expect(err.detail).toMatchObject(detail)
    return err
  }
  throw new Error(`expected ${code}`)
}

async function empty() {
  for (const table of TENANT) expect(await rows(table)).toBe(0)
}

beforeAll(async () => {
  await core.wipe_garden()
  await empty()
})

afterAll(async () => {
  await core.wipe_garden()
  const { data } = await db.storage.from("plant-photos").list(`${uid}/2026-09`)
  if (data?.length) await db.storage.from("plant-photos").remove(data.map((f) => `${uid}/2026-09/${f.name}`))
  await empty()
})

let bone = ""
let dayZeroWatering = 0

test("1. create_pot nursery 22", async () => {
  await core.create_pot({ label: "nursery 22", material: "plastic", diameter_cm: 22, height_cm: 18, drainage: true, saucer: true })
  const pot = (await core.pots()).find((p) => p.label === "nursery 22")!
  expect(pot.status).toBe("empty")
  expect(pot.volume_l).toBe(5.1)
})

test("2. create_pot deep 25 with only a label", async () => {
  await core.create_pot({ label: "deep 25" })
  const pot = (await core.pots()).find((p) => p.label === "deep 25")!
  expect(pot.material).toBeNull()
  expect(pot.diameter_cm).toBeNull()
  expect(pot.volume_l).toBeNull()
})

test("3. create_substrate grit mix", async () => {
  await core.create_substrate({
    label: "grit mix",
    parts: [
      { component: "potting_mix", percent: 60 },
      { component: "grit", percent: 30 },
      { component: "perlite", percent: 10 },
    ],
  })
  const mix = (await core.catalog()).substrates.find((s) => s.label === "grit mix")!
  expect(mix.owner_id).toBe(uid)
  expect(mix.parts).toHaveLength(3)
})

test("4. create_plant Lima", async () => {
  await core.create_plant({
    name: "Lima",
    taxon: "citrus-limon",
    origin: "nursery",
    origin_date: "2026-09-01",
    origin_date_precision: "month",
    location: "balcony",
    light: "full_sun",
    condition: "good",
    pot: "nursery 22",
    substrate: "grit mix",
    at: at(0),
  })
  const p = await core.plant({ plant: "Lima" })
  expect(p.water_interval_days).toBe(4)
  expect(p.water_status).toBe("due")
  expect(p.condition).toBe("good")
  expect(p.pot_shared_with).toBe(0)
  expect(p.substrate_matches_profile).toBe(false)
  expect(p.plan.map((r) => [r.status, r.hold_until])).toEqual([
    ["held", day(28)],
    ["held", day(28)],
  ])
  expect(p.events.map((e) => e.type)).toEqual(["repot", "diagnosis", "move"])
})

test("5. create_plant Sevilla with only a name", async () => {
  await core.create_plant({ name: "Sevilla" })
  const p = await core.plant({ plant: "Sevilla" })
  expect(p.taxon_id).toBeNull()
  expect(p.water_interval_days).toBeNull()
  expect(p.condition).toBeNull()
  expect(p.water_status).toBeNull()
  expect(p.plan).toEqual([])
})

test("6. update_plant identifies Sevilla, move to the balcony", async () => {
  await core.update_plant({ plants: ["Sevilla"], patch: { taxon: "citrus-sinensis", water_interval_days: 3 } })
  let p = await core.plant({ plant: "Sevilla" })
  expect(p.plan).toHaveLength(2)
  expect(p.plan.filter((r) => r.status === "held")).toHaveLength(0)
  expect(p.water_status).toBe("due")
  await core.move({ plants: ["Sevilla"], location: "balcony", light: "full_sun" })
  p = await core.plant({ plant: "Sevilla" })
  expect(p.location).toBe("balcony")
  expect(p.light_below_need).toBe(false)
})

test("7. water everything on day 0, back-date one watering", async () => {
  const all = await core.water({ at: at(0) })
  expect(all.filter((o) => o.event_id !== null)).toHaveLength(2)
  const garden = await core.garden()
  expect(garden.map((g) => iso(g.last_watered_at))).toEqual([iso(at(0)), iso(at(0))])
  const lima = await core.plant({ plant: "Lima" })
  dayZeroWatering = lima.events.find((e) => e.type === "watering")!.id
  await core.water({ plants: ["Lima"], at: at(-1) })
  const p = await core.plant({ plant: "Lima" })
  expect(iso(p.last_watered_at)).toBe(iso(at(0)))
  expect(p.water_due_on).toBe(today)
  expect(p.water_status).toBe("due")
})

test("8. diagnose Lima", async () => {
  await core.diagnose({ plant: "Lima", condition: "stressed", symptoms: ["stippling", "webbing"], pests: [{ pest: "spider_mites", status: "suspected" }] })
  const p = await core.plant({ plant: "Lima" })
  expect(p.attention).toBe(true)
  expect(p.pests).toEqual([{ pest: "spider_mites", status: "suspected", rounds: 0, last_treated: null }])
})

test("9. treat twice", async () => {
  await core.treat({ plants: ["Lima"], pest: "spider_mites", agent: "potassium soap", at: at(1) })
  await core.treat({ plants: ["Lima"], pest: "spider_mites", agent: "potassium soap", at: at(4) })
  const p = await core.plant({ plant: "Lima" })
  expect(p.pests[0]).toMatchObject({ status: "treating", rounds: 2 })
  expect(iso(p.pests[0]!.last_treated)).toBe(iso(at(4)))
  const treatment = (await core.due()).rows.find((d) => d.kind === "pest" && d.task_id === null && d.name === "Lima")!
  expect(treatment.due_on).toBe(day(11))
})

test("10. feed the default set, then Lima after releasing the hold", async () => {
  const offSeason = (await core.plant({ plant: "Sevilla" })).plan.find((r) => r.supplement_id === "liquid-citrus")!.status === "off_season"
  const fed = await core.feed({ supplement: "liquid-citrus" })
  expect(fed.map((o) => [o.name, o.event_id !== null, o.skipped_reason])).toEqual([
    ["Lima", false, "held"],
    ["Sevilla", !offSeason, offSeason ? "off_season" : null],
  ])
  expect(await core.update_feed({ plants: ["Lima"], supplement: "liquid-citrus", patch: { hold_until: null } })).toEqual([])
  await core.feed({ supplement: "liquid-citrus", plants: ["Lima"], dose_factor: 0.5 })
  const row = (await core.plant({ plant: "Lima" })).plan.find((r) => r.supplement_id === "liquid-citrus")!
  expect(row.last_fed).not.toBeNull()
  expect(row.status).toBe(offSeason ? "off_season" : "scheduled")
  expect(row.next_due).toBe(addDays(today, 14))
})

test("11. an owner supplement is loggable without a plan row", async () => {
  bone = (await core.create_supplement({ label: "bone meal", role: "feed", supplies: ["p"] })).id
  const fed = await core.feed({ supplement: bone, plants: ["Lima"] })
  expect(fed).toHaveLength(1)
  const p = await core.plant({ plant: "Lima" })
  expect(p.events.filter((e) => e.type === "feed" && e.data.supplement_id === bone)).toHaveLength(1)
  expect(p.plan.find((r) => r.supplement_id === bone)).toBeUndefined()
})

test("12. a deficiency recommends a corrective", async () => {
  await core.diagnose({ plant: "Sevilla", disorders: ["mg_deficiency"] })
  let row = (await core.plant({ plant: "Sevilla" })).plan.find((r) => r.supplement_id === "epsom-salts")!
  expect(row.status).toBe("recommended")
  await core.feed({ supplement: "epsom-salts", plants: ["Sevilla"] })
  row = (await core.plant({ plant: "Sevilla" })).plan.find((r) => r.supplement_id === "epsom-salts")!
  expect(row.status).toBe("scheduled")
  expect(row.next_due).toBe(addDays(today, 21))
})

test("13. measure, prune, bulk move", async () => {
  await core.measure({ plant: "Lima", height_cm: 40 })
  await core.prune({ plant: "Lima", part: "deadwood" })
  const moved = await core.move({ plants: { location: "balcony" }, location: "quarantine", light: "bright_shade" })
  expect(moved).toHaveLength(2)
  const garden = await core.garden()
  expect(garden.every((g) => g.location === "quarantine" && g.light_below_need === true)).toBe(true)
  expect((await core.plant({ plant: "Lima" })).height_cm).toBe(40)
})

test("14. garden-level note, group photo, foreign path", async () => {
  const noted = await core.note({ text: "Neighbour waters while away" })
  expect(noted).toEqual([{ plant_id: null, name: null, event_id: expect.any(Number), skipped_reason: null }])
  const path = `${uid}/2026-09/x.jpg`
  const { error } = await db.storage.from("plant-photos").upload(path, new Blob([new Uint8Array([255, 216, 255, 217])], { type: "image/jpeg" }), { contentType: "image/jpeg" })
  expect(error).toBeNull()
  const shots = await core.photo({ path, plants: ["Lima", "Sevilla"], shot: "group" })
  expect(shots.map((o) => o.name)).toEqual(["Lima", "Sevilla"])
  await fails(core.photo({ path: `c1f7ad70-bbef-4217-bf27-159158654331/x.jpg`, plants: ["Lima"] }), "invalid_value", { field: "path" })
})

test("15. void the day-0 watering", async () => {
  await core.void_event({ event: dayZeroWatering, reason: "wrong plant" })
  const p = await core.plant({ plant: "Lima" })
  expect(iso(p.last_watered_at)).toBe(iso(at(-1)))
  expect(p.water_due_on).toBe(day(3))
  expect(p.water_status).toBe("overdue")
})

test("16. plan a repot, repot, retire the old pot", async () => {
  const deep = await core.update_pot({ pot: "deep 25", patch: { diameter_cm: 25, height_cm: 22, drainage: true } })
  expect(deep.drainage).toBe(true)
  expect((await core.pots()).find((p) => p.label === "deep 25")!.volume_l).toBe(8.1)
  await core.update_plant({ plants: ["Lima"], patch: { repot_target_cm: 25, repot_after: day(0) } })
  let p = await core.plant({ plant: "Lima" })
  expect(p.pot_fit).toBe("step_up")
  expect(p.repot_due).toBe(true)
  await core.repot({ plant: "Lima", pot: "deep 25", substrate: "universal-perlite-25", roots: "healthy" })
  p = await core.plant({ plant: "Lima" })
  expect(p.pot_label).toBe("deep 25")
  expect(p.repot_target_cm).toBeNull()
  expect(p.substrate_matches_profile).toBe(true)
  expect(p.plan.map((r) => [r.status, r.hold_until])).toEqual([
    ["held", addDays(today, 28)],
    ["held", addDays(today, 28)],
  ])
  expect((await core.pots()).find((x) => x.label === "nursery 22")!.status).toBe("empty")
  expect((await core.retire_pot({ pot: "nursery 22" })).retired_at).not.toBeNull()
  await fails(core.retire_pot({ pot: "deep 25" }), "invalid_transition", { current: "in_use" })
})

test("17. clear the case", async () => {
  await core.diagnose({ plant: "Lima", pests: [] })
  expect((await core.plant({ plant: "Lima" })).pests).toEqual([])
})

test("18. tasks", async () => {
  const [task] = await core.create_task({ title: "Buy grit", kind: "shop" })
  const [done] = await core.complete_task({ tasks: [task!.id], status: "skipped" })
  expect(done?.status).toBe("skipped")
})

test("19. error shapes", async () => {
  const bad = await fails(core.diagnose({ plant: "Lima", pests: [{ pest: "cochonilha" as "scale", status: "confirmed" }] }), "invalid_value", { field: "pests.pest" })
  expect(bad.detail.allowed).toContain("spider_mites")
  await fails(core.water({ plants: ["Nobody"] }), "not_found", { plant: "Nobody" })
  await fails(core.update_pot({ pot: "deep 25", patch: { drainage: false } }), "invalid_transition", { current: "true" })
})

test("20. archive both plants", async () => {
  const before = await rows("events")
  await core.archive_plant({ plant: "Sevilla", reason: "mistake" })
  await core.archive_plant({ plant: "Lima", reason: "given_away" })
  expect(await core.garden()).toEqual([])
  expect((await core.pots()).find((p) => p.label === "deep 25")!.status).toBe("empty")
  expect(await rows("events")).toBe(before + 2)
})
