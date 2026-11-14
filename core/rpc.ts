import { z } from "zod"

import { enums } from "./schema"

export const rpc = {
  archive_plant: z.object({ plant: z.string(), reason: z.enum(enums.archive_reason) }).strict(),
  complete_task: z.object({ tasks: z.unknown(), status: z.enum(enums.task_status).optional() }).strict(),
  create_plant: z.object({ name: z.string(), taxon: z.string().optional(), origin: z.enum(enums.origin_type).optional(), origin_date: z.iso.date().optional(), origin_date_precision: z.enum(enums.date_precision).optional(), individuals: z.int().optional(), water_interval_days: z.int().optional(), location: z.enum(enums.location_zone).optional(), light: z.enum(enums.light_level).optional(), condition: z.enum(enums.condition).optional(), phase: z.enum(enums.phenophase).optional(), height_cm: z.number().optional(), pot: z.string().optional(), substrate: z.string().optional(), notes: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  create_pot: z.object({ label: z.string(), material: z.enum(enums.pot_material).optional(), diameter_cm: z.number().optional(), height_cm: z.number().optional(), drainage: z.boolean().optional(), saucer: z.boolean().optional(), notes: z.string().optional() }).strict(),
  create_substrate: z.object({ label: z.string(), parts: z.unknown().optional() }).strict(),
  create_supplement: z.object({ label: z.string(), role: z.enum(enums.supplement_role).optional(), form: z.enum(enums.supplement_form).optional(), supplies: z.array(z.enum(enums.nutrient)).optional(), method: z.enum(enums.feed_method).optional() }).strict(),
  create_task: z.object({ title: z.string(), kind: z.enum(enums.task_kind).optional(), plant: z.string().optional(), due_on: z.iso.date().optional(), priority: z.int().optional(), detail: z.string().optional() }).strict(),
  diagnose: z.object({ plant: z.string(), condition: z.enum(enums.condition).optional(), phase: z.enum(enums.phenophase).optional(), symptoms: z.array(z.enum(enums.symptom)).optional(), disorders: z.array(z.enum(enums.disorder)).optional(), pests: z.unknown().optional(), note: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  event_schema: z.object({ t: z.enum(enums.event_type) }).strict(),
  feed: z.object({ supplement: z.string(), plants: z.unknown().optional(), dose_factor: z.number().optional(), method: z.enum(enums.feed_method).optional(), note: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  local_date: z.object({ ts: z.iso.datetime({ offset: true }).optional() }).strict(),
  measure: z.object({ plant: z.string(), height_cm: z.number().optional(), canopy_cm: z.number().optional(), trunk_mm: z.number().optional(), note: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  move: z.object({ plants: z.unknown(), location: z.enum(enums.location_zone).optional(), light: z.enum(enums.light_level).optional(), note: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  note: z.object({ text: z.string(), plants: z.unknown().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  photo: z.object({ path: z.string(), plants: z.unknown().optional(), shot: z.enum(enums.photo_shot).optional(), note: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  prune: z.object({ plant: z.string(), part: z.enum(enums.prune_part), note: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  repot: z.object({ plant: z.string(), pot: z.string(), substrate: z.string().optional(), roots: z.enum(enums.root_condition).optional(), root_pruned: z.boolean().optional(), hold_feed_days: z.int().optional(), note: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  retire_pot: z.object({ pot: z.string() }).strict(),
  treat: z.object({ plants: z.unknown(), pest: z.enum(enums.pest), agent: z.string().optional(), note: z.string().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  update_feed: z.object({ plants: z.unknown(), supplement: z.string(), patch: z.unknown() }).strict(),
  update_plant: z.object({ plants: z.unknown(), patch: z.unknown() }).strict(),
  update_pot: z.object({ pot: z.string(), patch: z.unknown() }).strict(),
  void_event: z.object({ event: z.int(), reason: z.string() }).strict(),
  water: z.object({ plants: z.unknown().optional(), method: z.enum(enums.watering_method).optional(), ml: z.int().optional(), at: z.iso.datetime({ offset: true }).optional() }).strict(),
  wipe_garden: z.object({}).strict(),
}
