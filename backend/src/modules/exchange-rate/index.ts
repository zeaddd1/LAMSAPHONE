import { Module } from "@medusajs/framework/utils"
import ExchangeRateModuleService from "./service"

export const EXCHANGE_RATE_MODULE = "exchange_rate"

export default Module(EXCHANGE_RATE_MODULE, {
  service: ExchangeRateModuleService,
})
