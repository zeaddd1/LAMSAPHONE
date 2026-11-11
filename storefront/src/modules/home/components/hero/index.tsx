import LocalizedClientLink from "@modules/common/components/localized-client-link"

// شريط العروض الرئيسي (نصوص ثابتة؛ لاحقاً يمكن ربطه بمجموعة "عروض" من اللوحة)
const Hero = () => {
  return (
    <section className="w-full bg-brand-navy text-white">
      <div className="content-container flex flex-col items-start gap-5 py-16 small:py-24">
        <span className="rounded-full bg-brand-orange/20 text-brand-orange px-3 py-1 text-small-semi">عروض الأسبوع</span>
        <h1 className="text-3xl small:text-5xl font-bold leading-tight">جوالات أصلية بأسعار تنافسية</h1>
        <p className="text-base-regular text-white/80 max-w-xl">
          جديد ومستعمل ومجدّد، مع إكسسوارات أصلية. الدفع عند الاستلام والتوصيل داخل المدينة أو الاستلام من المحل.
        </p>
        <div className="flex gap-3">
          <LocalizedClientLink href="/store" className="rounded-lg bg-brand-orange px-6 py-3 font-bold text-white hover:opacity-90">
            تسوّق الآن
          </LocalizedClientLink>
          <LocalizedClientLink href="/categories/جوالات" className="rounded-lg border border-white/40 px-6 py-3 text-white hover:bg-white/10">
            الجوالات
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}

export default Hero
