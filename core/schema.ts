export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export const enums = {
  archive_reason: ["dead", "given_away", "lost", "mistake"],
  condition: ["critical", "poor", "stressed", "good", "thriving"],
  date_precision: ["day", "month", "year"],
  disorder: ["underwatering", "overwatering", "waterlogging", "salt_buildup", "low_light", "sunburn", "wind_damage", "cold_damage", "rootbound", "n_deficiency", "mg_deficiency", "fe_deficiency"],
  event_type: ["watering", "feed", "treatment", "repot", "prune", "measure", "diagnosis", "move", "photo", "note"],
  feed_method: ["incorporate", "drench", "foliar"],
  feed_status: ["overdue", "due", "scheduled", "held", "off_season", "recommended"],
  light_level: ["bright_shade", "part_sun", "full_sun"],
  location_zone: ["indoor", "balcony", "quarantine"],
  nutrient: ["n", "p", "k", "mg", "fe", "micro"],
  origin_type: ["seed", "cutting", "graft", "nursery"],
  pest: ["spider_mites", "mealybugs", "scale", "aphids", "whitefly", "thrips", "ants", "root_rot", "fungal_leaf_spot"],
  pest_status: ["suspected", "confirmed", "treating", "cleared"],
  phenophase: ["dormant", "vegetative", "flowering", "fruiting"],
  photo_shot: ["full", "closeup", "leaves", "underside", "soil", "roots", "pot", "group"],
  pot_fit: ["unplanned", "step_up", "undersized"],
  pot_material: ["plastic", "glazed_ceramic", "terracotta", "glass"],
  pot_status: ["in_use", "empty", "retired"],
  prune_part: ["canopy", "roots", "deadwood", "flowers", "suckers"],
  root_condition: ["healthy", "rootbound", "circling", "dry", "rotted", "unknown"],
  substrate_component: ["potting_mix", "perlite", "grit", "sand", "bark", "coir"],
  supplement_form: ["controlled_release", "liquid", "soluble"],
  supplement_role: ["feed", "corrective", "biostimulant"],
  symptom: ["chlorosis", "interveinal_chlorosis", "necrosis", "tip_dieback", "leaf_drop", "wilting", "curling", "scorch", "etiolation", "stippling", "webbing", "honeydew", "sooty_mold", "stunted", "no_fruit"],
  task_kind: ["water", "feed", "pest", "pot", "light", "prune", "inspect", "photo", "shop", "other"],
  task_status: ["todo", "done", "skipped"],
  trend: ["improving", "steady", "declining"],
  water_regime: ["drought_tolerant", "dry_top", "evenly_moist"],
  water_status: ["overdue", "due", "soon", "ok"],
  watering_method: ["top", "basin", "soak"],
} as const

export type Enums = { [K in keyof typeof enums]: (typeof enums)[K][number] }

export interface Tables {
  care_profile: {
    id: string
    label: string
    light: Enums["light_level"]
    water: Enums["water_regime"]
    pests: Enums["pest"][]
    substrate_id: string
    notes: string | null
  }
  events: {
    id: number
    owner_id: string
    plant_id: string | null
    ts: string
    type: Enums["event_type"]
    data: Json | null
    note: string | null
    photo_url: string | null
    source: string
    voided_at: string | null
    voided_reason: string | null
  }
  feed_override: {
    owner_id: string
    plant_id: string
    supplement_id: string
    dose_factor: number | null
    hold_until: string | null
  }
  pest_case: {
    id: number
    owner_id: string
    plant_id: string
    pest: Enums["pest"]
    status: Enums["pest_status"]
    opened_at: string
    last_treated: string | null
    rounds: number
    closed_at: string | null
  }
  plants: {
    id: string
    owner_id: string
    name: string
    taxon_id: string | null
    origin: Enums["origin_type"] | null
    origin_date: string | null
    origin_date_precision: Enums["date_precision"] | null
    individuals: number
    location: Enums["location_zone"] | null
    light: Enums["light_level"] | null
    water_interval_days: number | null
    condition: Enums["condition"] | null
    phase: Enums["phenophase"] | null
    symptoms: Enums["symptom"][]
    disorders: Enums["disorder"][]
    pot_id: string | null
    height_cm: number | null
    repot_target_cm: number | null
    repot_after: string | null
    cover_event_id: number | null
    archived_at: string | null
    archived_reason: Enums["archive_reason"] | null
    notes: string | null
    created_at: string
  }
  pots: {
    id: string
    owner_id: string
    label: string
    material: Enums["pot_material"] | null
    diameter_cm: number | null
    height_cm: number | null
    drainage: boolean | null
    saucer: boolean
    substrate_id: string | null
    substrate_since: string | null
    retired_at: string | null
    notes: string | null
    created_at: string
  }
  profiles: {
    id: string
    display_name: string
    created_at: string
    updated_at: string
    timezone: string
  }
  programme: {
    profile_id: string
    supplement_id: string
    dose_factor: number
    cadence_days: number
    season_start: number
    season_end: number
  }
  substrate: {
    id: string
    label: string
    owner_id: string | null
  }
  substrate_part: {
    substrate_id: string
    component: Enums["substrate_component"]
    percent: number | null
  }
  supplement: {
    id: string
    owner_id: string | null
    label: string
    form: Enums["supplement_form"] | null
    role: Enums["supplement_role"]
    supplies: Enums["nutrient"][]
    method: Enums["feed_method"] | null
  }
  tasks: {
    id: number
    owner_id: string
    plant_id: string | null
    title: string
    kind: Enums["task_kind"]
    status: Enums["task_status"]
    due_on: string | null
    priority: number
    detail: string | null
    completed_at: string | null
    created_at: string
  }
  taxon: {
    id: string
    genus: string
    species: string | null
    common: string
    emoji: string
    profile_id: string
    latin: string | null
  }
}

export interface Views {
  due: {
    plant_id: string | null
    name: string | null
    kind: Enums["task_kind"]
    item: string
    due_on: string | null
    task_id: number | null
  }
  garden: {
    plant_id: string
    name: string
    taxon_id: string | null
    common: string | null
    latin: string | null
    emoji: string | null
    profile_id: string | null
    profile_label: string | null
    origin: Enums["origin_type"] | null
    origin_date: string | null
    origin_date_precision: Enums["date_precision"] | null
    individuals: number
    location: Enums["location_zone"] | null
    light: Enums["light_level"] | null
    light_need: Enums["light_level"] | null
    light_below_need: boolean | null
    water_regime: Enums["water_regime"] | null
    water_interval_days: number | null
    last_watered_at: string | null
    water_due_on: string | null
    water_status: Enums["water_status"] | null
    condition: Enums["condition"] | null
    phase: Enums["phenophase"] | null
    trend: Enums["trend"] | null
    symptoms: Enums["symptom"][]
    disorders: Enums["disorder"][]
    pests: Json | null
    pests_watch: Enums["pest"][] | null
    attention: boolean
    height_cm: number | null
    pot_id: string | null
    pot_label: string | null
    pot_diameter_cm: number | null
    pot_material: Enums["pot_material"] | null
    pot_sealed: boolean | null
    pot_shared_with: number | null
    substrate_id: string | null
    substrate_age_days: number | null
    substrate_matches_profile: boolean | null
    repot_target_cm: number | null
    repot_after: string | null
    repot_due: boolean
    pot_fit: Enums["pot_fit"]
    feed_alert: Enums["feed_status"] | null
    never_fed: boolean
    cover_url: string | null
    cover_is_pinned: boolean
    last_event_at: string | null
    notes: string | null
  }
  plant_feed: {
    plant_id: string
    supplement_id: string
    label: string
    form: Enums["supplement_form"] | null
    role: Enums["supplement_role"]
    method: Enums["feed_method"] | null
    dose_factor: number
    cadence_days: number | null
    season_start: number | null
    season_end: number | null
    hold_until: string | null
    last_fed: string | null
    next_due: string | null
    status: Enums["feed_status"]
  }
  pots_view: {
    pot_id: string
    label: string
    material: Enums["pot_material"] | null
    porous: boolean | null
    diameter_cm: number | null
    height_cm: number | null
    volume_l: number | null
    drainage: boolean | null
    saucer: boolean
    substrate_id: string | null
    substrate_since: string | null
    occupants: Json | null
    status: Enums["pot_status"]
    notes: string | null
  }
}

export interface Fn {
  archive_plant: { Args: { plant: string; reason: Enums["archive_reason"] }; Returns: Tables["plants"][] }
  complete_task: { Args: { tasks: Json; status?: Enums["task_status"] }; Returns: Tables["tasks"][] }
  create_plant: { Args: { name: string; taxon?: string; origin?: Enums["origin_type"]; origin_date?: string; origin_date_precision?: Enums["date_precision"]; individuals?: number; water_interval_days?: number; location?: Enums["location_zone"]; light?: Enums["light_level"]; condition?: Enums["condition"]; phase?: Enums["phenophase"]; height_cm?: number; pot?: string; substrate?: string; notes?: string; at?: string }; Returns: Tables["plants"][] }
  create_pot: { Args: { label: string; material?: Enums["pot_material"]; diameter_cm?: number; height_cm?: number; drainage?: boolean; saucer?: boolean; notes?: string }; Returns: Tables["pots"] }
  create_substrate: { Args: { label: string; parts?: Json }; Returns: Tables["substrate"] }
  create_supplement: { Args: { label: string; role?: Enums["supplement_role"]; form?: Enums["supplement_form"]; supplies?: Enums["nutrient"][]; method?: Enums["feed_method"] }; Returns: Tables["supplement"] }
  create_task: { Args: { title: string; kind?: Enums["task_kind"]; plant?: string; due_on?: string; priority?: number; detail?: string }; Returns: Tables["tasks"][] }
  diagnose: { Args: { plant: string; condition?: Enums["condition"]; phase?: Enums["phenophase"]; symptoms?: Enums["symptom"][]; disorders?: Enums["disorder"][]; pests?: Json; note?: string; at?: string }; Returns: number }
  event_schema: { Args: { t: Enums["event_type"] }; Returns: Json }
  feed: { Args: { supplement: string; plants?: Json; dose_factor?: number; method?: Enums["feed_method"]; note?: string; at?: string }; Returns: { plant_id: string | null; name: string | null; event_id: number | null; skipped_reason: string | null }[] }
  local_date: { Args: { ts?: string }; Returns: string }
  measure: { Args: { plant: string; height_cm?: number; canopy_cm?: number; trunk_mm?: number; note?: string; at?: string }; Returns: number }
  move: { Args: { plants: Json; location?: Enums["location_zone"]; light?: Enums["light_level"]; note?: string; at?: string }; Returns: { plant_id: string | null; name: string | null; event_id: number | null; skipped_reason: string | null }[] }
  note: { Args: { text: string; plants?: Json; at?: string }; Returns: { plant_id: string | null; name: string | null; event_id: number | null; skipped_reason: string | null }[] }
  photo: { Args: { path: string; plants?: Json; shot?: Enums["photo_shot"]; note?: string; at?: string }; Returns: { plant_id: string | null; name: string | null; event_id: number | null; skipped_reason: string | null }[] }
  prune: { Args: { plant: string; part: Enums["prune_part"]; note?: string; at?: string }; Returns: number }
  repot: { Args: { plant: string; pot: string; substrate?: string; roots?: Enums["root_condition"]; root_pruned?: boolean; hold_feed_days?: number; note?: string; at?: string }; Returns: { event_id: number | null; warning: string | null }[] }
  retire_pot: { Args: { pot: string }; Returns: Tables["pots"] }
  treat: { Args: { plants: Json; pest: Enums["pest"]; agent?: string; note?: string; at?: string }; Returns: { plant_id: string | null; name: string | null; event_id: number | null; skipped_reason: string | null }[] }
  update_feed: { Args: { plants: Json; supplement: string; patch: Json }; Returns: Tables["feed_override"][] }
  update_plant: { Args: { plants: Json; patch: Json }; Returns: Tables["plants"][] }
  update_pot: { Args: { pot: string; patch: Json }; Returns: Tables["pots"] }
  void_event: { Args: { event: number; reason: string }; Returns: number }
  water: { Args: { plants?: Json; method?: Enums["watering_method"]; ml?: number; at?: string }; Returns: { plant_id: string | null; name: string | null; event_id: number | null; skipped_reason: string | null }[] }
  wipe_garden: { Args: Record<string, never>; Returns: void }
}
