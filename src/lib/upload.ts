import { core } from "./core"
import { supabase } from "./supabase"

const BUCKET = "plant-photos"

const MAX_EDGE_PX = 2048
const JPEG_QUALITY = 0.85

async function downscale(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return null
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, w, h)
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    )
  } finally {
    bitmap.close()
  }
}

export async function uploadPlantPhoto(plantId: string, file: File): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id
  if (!uid) throw new Error("Not signed in")

  const reduced = await downscale(file)
  const blob: Blob = reduced ?? file
  const ext = reduced ? "jpg" : file.name.split(".").pop()?.toLowerCase() || "bin"
  const contentType = reduced ? "image/jpeg" : file.type || "application/octet-stream"
  const path = `${uid}/${plantId}/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType, cacheControl: "3600", upsert: false })
  if (uploadError) throw new Error(uploadError.message)

  await core.photo({ path, plants: [plantId] })
}
