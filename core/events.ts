import { z } from "zod"

import { enums, type Enums } from "./schema"

export const eventJson = {
  watering: {"additionalProperties":false,"properties":{"method":{"enum":["top","basin","soak"],"type":"string"},"ml":{"anyOf":[{"maximum":9007199254740991,"minimum":0,"type":"integer"},{"type":"null"}]}},"required":["method","ml"],"type":"object"},
  feed: {"additionalProperties":false,"properties":{"dose_factor":{"type":"number"},"method":{"anyOf":[{"enum":["incorporate","drench","foliar"],"type":"string"},{"type":"null"}]},"supplement_id":{"type":"string"}},"required":["supplement_id","dose_factor","method"],"type":"object"},
  treatment: {"additionalProperties":false,"properties":{"agent":{"type":["string","null"]},"pest":{"enum":["spider_mites","mealybugs","scale","aphids","whitefly","thrips","ants","root_rot","fungal_leaf_spot"],"type":"string"}},"required":["pest","agent"],"type":"object"},
  repot: {"additionalProperties":false,"properties":{"root_pruned":{"type":"boolean"},"roots":{"enum":["healthy","rootbound","circling","dry","rotted","unknown"],"type":"string"},"substrate_id":{"type":["string","null"]},"to_pot_id":{"type":"string"}},"required":["to_pot_id","substrate_id","roots","root_pruned"],"type":"object"},
  prune: {"additionalProperties":false,"properties":{"part":{"enum":["canopy","roots","deadwood","flowers","suckers"],"type":"string"}},"required":["part"],"type":"object"},
  measure: {"additionalProperties":false,"properties":{"canopy_cm":{"type":["number","null"]},"height_cm":{"type":["number","null"]},"trunk_mm":{"type":["number","null"]}},"required":["height_cm","canopy_cm","trunk_mm"],"type":"object"},
  diagnosis: {"additionalProperties":false,"properties":{"condition":{"anyOf":[{"enum":["critical","poor","stressed","good","thriving"],"type":"string"},{"type":"null"}]},"disorders":{"anyOf":[{"items":{"enum":["underwatering","overwatering","waterlogging","salt_buildup","low_light","sunburn","wind_damage","cold_damage","rootbound","n_deficiency","mg_deficiency","fe_deficiency"],"type":"string"},"type":"array"},{"type":"null"}]},"pests":{"anyOf":[{"items":{"additionalProperties":false,"properties":{"pest":{"enum":["spider_mites","mealybugs","scale","aphids","whitefly","thrips","ants","root_rot","fungal_leaf_spot"],"type":"string"},"status":{"enum":["suspected","confirmed","cleared"],"type":"string"}},"required":["pest","status"],"type":"object"},"type":"array"},{"type":"null"}]},"phase":{"anyOf":[{"enum":["dormant","vegetative","flowering","fruiting"],"type":"string"},{"type":"null"}]},"symptoms":{"anyOf":[{"items":{"enum":["chlorosis","interveinal_chlorosis","necrosis","tip_dieback","leaf_drop","wilting","curling","scorch","etiolation","stippling","webbing","honeydew","sooty_mold","stunted","no_fruit"],"type":"string"},"type":"array"},{"type":"null"}]}},"required":["condition","phase","symptoms","disorders","pests"],"type":"object"},
  move: {"additionalProperties":false,"properties":{"light":{"anyOf":[{"enum":["bright_shade","part_sun","full_sun"],"type":"string"},{"type":"null"}]},"location":{"anyOf":[{"enum":["indoor","balcony","quarantine"],"type":"string"},{"type":"null"}]}},"required":["location","light"],"type":"object"},
  photo: {"additionalProperties":false,"properties":{"shot":{"anyOf":[{"enum":["full","closeup","leaves","underside","soil","roots","pot","group"],"type":"string"},{"type":"null"}]}},"required":["shot"],"type":"object"},
  note: {"type":"null"},
} satisfies Record<Enums["event_type"], unknown>

export const eventSchemas = {
  watering: z.object({ method: z.enum(enums.watering_method), ml: z.int().min(0).nullable() }).strict(),
  feed: z.object({ supplement_id: z.string(), dose_factor: z.number(), method: z.enum(enums.feed_method).nullable() }).strict(),
  treatment: z.object({ pest: z.enum(enums.pest), agent: z.string().nullable() }).strict(),
  repot: z.object({ to_pot_id: z.string(), substrate_id: z.string().nullable(), roots: z.enum(enums.root_condition), root_pruned: z.boolean() }).strict(),
  prune: z.object({ part: z.enum(enums.prune_part) }).strict(),
  measure: z.object({ height_cm: z.number().nullable(), canopy_cm: z.number().nullable(), trunk_mm: z.number().nullable() }).strict(),
  diagnosis: z.object({ condition: z.enum(enums.condition).nullable(), phase: z.enum(enums.phenophase).nullable(), symptoms: z.array(z.enum(enums.symptom)).nullable(), disorders: z.array(z.enum(enums.disorder)).nullable(), pests: z.array(z.object({ pest: z.enum(enums.pest), status: z.enum(["suspected", "confirmed", "cleared"]) }).strict()).nullable() }).strict(),
  move: z.object({ location: z.enum(enums.location_zone).nullable(), light: z.enum(enums.light_level).nullable() }).strict(),
  photo: z.object({ shot: z.enum(enums.photo_shot).nullable() }).strict(),
  note: z.null(),
} satisfies Record<Enums["event_type"], z.ZodType>
