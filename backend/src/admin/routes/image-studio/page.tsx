import { Text } from "@medusajs/ui"
import { useEffect } from "react"

// «استوديو الصور» صار جزءاً من «الاستوديو الإبداعي» (صفحة الإضافة السريعة). هذه الصفحة تحوّل الروابط القديمة فقط.
const ImageStudioRedirect = () => {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const product = q.get("product")
    window.location.replace(product ? `/app/quick-add?tab=post&product=${encodeURIComponent(product)}` : "/app/quick-add?tab=design")
  }, [])
  return <Text className="p-6">جارٍ فتح الاستوديو الإبداعي…</Text>
}

export default ImageStudioRedirect
