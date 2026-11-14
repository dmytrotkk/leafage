import { SQL } from "bun"

const file = process.argv[2]
if (!file) throw new Error("usage: bun tools/sql.ts <file.sql>")
const sql = new SQL(process.env.DATABASE_URL!, { max: 1 })
const rows = (await sql.unsafe(await Bun.file(file).text())) as Record<string, unknown>[]
await sql.end()
const first = rows[0]
const only = rows.length === 1 && first && Object.keys(first).length === 1 ? Object.values(first)[0] : rows
console.log(typeof only === "string" ? only : JSON.stringify(only))
