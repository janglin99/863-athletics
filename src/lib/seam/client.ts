import { Seam } from "seam"

let seamClient: Seam | null = null

export function getSeamClient() {
  if (!seamClient && process.env.SEAM_API_KEY) {
    seamClient = new Seam({ apiKey: process.env.SEAM_API_KEY })
  }
  return seamClient
}
