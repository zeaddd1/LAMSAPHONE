import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Text } from "@medusajs/ui"

// زر يفتح صفحة الإضافة السريعة أعلى قائمة المنتجات
const QuickAddButton = () => (
  <Container className="flex items-center justify-between px-6 py-3" dir="rtl">
    <Text size="small">أضف منتجاً بالاسم والقسم والصور والسعر فقط، وانشره على ميتا مباشرة.</Text>
    <Button size="small" asChild>
      <a href="/app/quick-add">إضافة سريعة</a>
    </Button>
  </Container>
)

export const config = defineWidgetConfig({ zone: "product.list.before" })

export default QuickAddButton
