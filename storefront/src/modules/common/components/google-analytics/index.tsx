import { getAnalytics } from "@lib/data/analytics"

/**
 * أدوات الزوار (Google Analytics وTag Manager وMicrosoft Clarity) في كل صفحات المتجر، من لوحة "زوار المتجر".
 * وسوم <script> عادية داخل HTML الصفحة نفسها، فتعمل مع أول تحميل للصفحة.
 * (next/script مع كود مضمّن لم يكن يُنفَّذ في المتجر المنشور، فلم تصل أي زيارة إلى جوجل أو كلاريتي)
 * المعرّفات مفحوصة بنمط صارم في getAnalytics، فلا يمكن حقن كود عبرها.
 */
export default async function GoogleAnalytics() {
  const { gtm_id, ga_id, clarity_id } = await getAnalytics()
  return (
    <>
      {ga_id && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${ga_id}`} />
          <script
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga_id}');`,
            }}
          />
        </>
      )}
      {gtm_id && (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm_id}');`,
          }}
        />
      )}
      {clarity_id && (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity_id}");`,
          }}
        />
      )}
    </>
  )
}
