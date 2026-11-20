import { AnalyticsInput } from "../../analytics-settings"

describe("analytics ids", () => {
  it("accepts GTM and Clarity ids, normalizes case, empty disconnects", () => {
    expect(AnalyticsInput.parse({ gtm_id: "gtm-kqzhn5nb", clarity_id: "ZGDOMW1KZA" })).toEqual({ gtm_id: "GTM-KQZHN5NB", clarity_id: "zgdomw1kza" })
    expect(AnalyticsInput.parse({})).toEqual({ gtm_id: "", clarity_id: "" })
  })
  it("rejects anything that could inject script", () => {
    expect(AnalyticsInput.safeParse({ gtm_id: "GTM-x'); alert(1)//" }).success).toBe(false)
    expect(AnalyticsInput.safeParse({ clarity_id: "<script>" }).success).toBe(false)
    expect(AnalyticsInput.safeParse({ gtm_id: "G-ABC123" }).success).toBe(false)
  })
})
