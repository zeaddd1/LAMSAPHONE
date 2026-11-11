import { convertFromUsd, roundToStep } from "../currency"

describe("roundToStep", () => {
  it("rounds to nearest 100 for Yemeni rial", () => {
    expect(roundToStep(15349, 100)).toBe(15300)
    expect(roundToStep(15350, 100)).toBe(15400)
  })
  it("rounds to nearest 0.5 for SAR without float noise", () => {
    expect(roundToStep(37.24, 0.5)).toBe(37)
    expect(roundToStep(37.26, 0.5)).toBe(37.5)
    expect(roundToStep(0.1 + 0.2, 0.01)).toBe(0.3)
  })
  it("handles zero", () => {
    expect(roundToStep(0, 100)).toBe(0)
  })
  it("falls back to cents when step is 0", () => {
    expect(roundToStep(1.005 * 1000, 0)).toBe(1005)
  })
})

describe("convertFromUsd", () => {
  it("converts and rounds", () => {
    expect(convertFromUsd(100, 3.75, 0.5)).toBe(375)
    expect(convertFromUsd(99.99, 530, 100)).toBe(53000)
  })
  it("handles fractions and large numbers", () => {
    expect(convertFromUsd(0.01, 2000, 100)).toBe(0)
    expect(convertFromUsd(1_000_000, 2000, 100)).toBe(2_000_000_000)
  })
  it("rejects invalid input", () => {
    expect(() => convertFromUsd(-1, 3.75, 0.5)).toThrow()
    expect(() => convertFromUsd(10, 0, 0.5)).toThrow()
    expect(() => convertFromUsd(NaN, 3.75, 0.5)).toThrow()
  })
})
