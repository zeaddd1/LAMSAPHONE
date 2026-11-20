import { AnalyticsInput } from "../../analytics-settings"

describe("analytics ids", () => {
  it("accepts GTM and Clarity ids, normalizes case, empty disconnects", () => {
    expect(AnalyticsInput.parse({ gtm_id: "gtm-kqzhn5nb", ga_id: "g-jdty0zn3se", clarity_id: "ZGDOMW1KZA" })).toEqual({ gtm_id: "GTM-KQZHN5NB", ga_id: "G-JDTY0ZN3SE", clarity_id: "zgdomw1kza" })
    expect(AnalyticsInput.parse({})).toEqual({ gtm_id: "", ga_id: "", clarity_id: "" })
  })
  it("rejects anything that could inject script", () => {
    expect(AnalyticsInput.safeParse({ gtm_id: "GTM-x'); alert(1)//" }).success).toBe(false)
    expect(AnalyticsInput.safeParse({ clarity_id: "<script>" }).success).toBe(false)
    expect(AnalyticsInput.safeParse({ gtm_id: "G-ABC123" }).success).toBe(false)
    expect(AnalyticsInput.safeParse({ ga_id: "G-x');alert(1)//" }).success).toBe(false)
    expect(AnalyticsInput.safeParse({ ga_id: "GTM-ABC123" }).success).toBe(false)
  })
})
