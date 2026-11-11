/** قالب بسيط للصفحات الثابتة (من نحن، تواصل، الاسترجاع) */
export default function StaticPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="content-container py-12 max-w-3xl">
      <h1 className="text-3xl font-bold text-brand-navy mb-6">{title}</h1>
      <div className="flex flex-col gap-4 text-base-regular leading-8 text-ui-fg-base">{children}</div>
    </div>
  )
}
