import { getSiteTexts } from "@lib/data/site-texts"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// يظهر فقط إن لم تُضف «عروض الأسبوع» من لوحة التحكم (واجهة المتجر ← + إضافة عرض)
// النصوص من لوحة التحكم ← نصوص المتجر
const Hero = async () => {
  const t = await getSiteTexts()
  return (
    <section className="w-full border-b border-gray-100 bg-white text-brand-navy">
      <div className="content-container flex flex-col items-start gap-5 py-14 small:py-20">
        <span className="rounded-full bg-brand-orange/10 px-3 py-1 text-small-semi text-brand-orange">{t.hero_badge}</span>
        <h1 className="text-3xl font-bold leading-tight small:text-5xl">{t.hero_title}</h1>
        <p className="max-w-xl whitespace-pre-line text-base-regular text-gray-600">{t.hero_text}</p>
        <div className="flex gap-3">
          <LocalizedClientLink href="/store" className="rounded-lg bg-brand-orange px-6 py-3 font-bold text-white hover:opacity-90">
            {t.hero_cta}
          </LocalizedClientLink>
          <LocalizedClientLink href="/categories/جوالات" className="rounded-lg border border-gray-300 px-6 py-3 text-brand-navy hover:bg-gray-50">
            {t.hero_cta2}
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}

export default Hero
