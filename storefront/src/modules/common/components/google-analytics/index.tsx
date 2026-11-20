import Script from "next/script"
import { getAnalytics } from "@lib/data/analytics"

/** أدوات الزوار (Google Tag Manager وMicrosoft Clarity) في كل صفحات المتجر، من لوحة "زوار المتجر" */
export default async function GoogleAnalytics() {
  const { gtm_id, ga_id, clarity_id } = await getAnalytics()
  return (
    <>
      {ga_id && (
        <>
          <Script id="gtag-src" src={`https://www.googletagmanager.com/gtag/js?id=${ga_id}`} strategy="afterInteractive" />
          <Script id="gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga_id}');`}
          </Script>
        </>
      )}
      {gtm_id && (
        <>
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm_id}');`}
          </Script>
        </>
      )}
      {clarity_id && (
        <Script id="clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity_id}");`}
        </Script>
      )}
    </>
  )
}
