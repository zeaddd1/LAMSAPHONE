"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { CURRENCY_COOKIE, defaultCurrency, isDisplayCurrency, type DisplayCurrency, type ExchangeRate } from "./format"

type Ctx = { currency: DisplayCurrency; rates: ExchangeRate[]; setCurrency: (c: DisplayCurrency) => void }
const CurrencyContext = createContext<Ctx>({ currency: defaultCurrency(), rates: [], setCurrency: () => {} })

/**
 * العملة تُقرأ من الكوكي في المتصفح (وليس في الخادم) حتى تبقى الصفحات العامة قابلة للكاش (ISR).
 * أسعار الصرف تأتي من الخادم (كاش 60 ثانية).
 */
export function CurrencyProvider({ rates, children }: { rates: ExchangeRate[]; children: React.ReactNode }) {
  const [currency, setState] = useState<DisplayCurrency>(defaultCurrency())

  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${CURRENCY_COOKIE}=([^;]*)`))
    const v = m?.[1]
    if (isDisplayCurrency(v)) setState(v)
  }, [])

  const setCurrency = (c: DisplayCurrency) => {
    document.cookie = `${CURRENCY_COOKIE}=${c}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    setState(c)
  }

  return <CurrencyContext.Provider value={{ currency, rates, setCurrency }}>{children}</CurrencyContext.Provider>
}

export const useCurrency = () => useContext(CurrencyContext)
