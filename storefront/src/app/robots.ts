import type { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/*/checkout", "/*/account", "/*/cart"] },
    sitemap: `${getBaseURL()}/sitemap.xml`,
  }
}
