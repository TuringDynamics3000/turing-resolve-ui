import express from "express"
import cors from "cors"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(cors())

function load(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "mock", file)))
}

app.get("/api/v1/ui/system/health", (_, res) => res.json(load("system-health.json")))
app.get("/api/v1/ui/domains", (_, res) => res.json(load("domains.json")))
app.get("/api/v1/ui/twin/scenarios", (_, res) => res.json(load("twin-scenarios.json")))
app.get("/api/v1/ui/documents/board-packs", (_, res) => res.json(load("board-packs.json")))
app.get("/api/v1/ui/documents/regulator-annexes", (_, res) => res.json(load("regulator-annexes.json")))

app.use("/documents", express.static(path.join(__dirname, "demo-pdfs")))

app.listen(8080, () => console.log("✅ UI Gateway running on http://localhost:8080"))
