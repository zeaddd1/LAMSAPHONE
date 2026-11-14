import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { installUploadInterceptor } from "../lib/upload-interceptor"

// يُفعَّل عند تحميل اللوحة نفسها (ملفات الإضافات تُستورد عند الإقلاع)،
// والمكوّن أدناه ضمان إضافي في صفحات المنتجات. لا يعرض أي شيء.
installUploadInterceptor()

const ImageAutoCompress = () => {
  installUploadInterceptor()
  return null
}

export const config = defineWidgetConfig({
  zone: ["product.list.before", "product.details.before"],
})

export default ImageAutoCompress
