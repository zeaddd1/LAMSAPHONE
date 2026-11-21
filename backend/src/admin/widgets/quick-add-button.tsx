import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Button, Container, Text } from "@medusajs/ui"

// زر يفتح صفحة الإضافة السريعة أعلى قائمة المنتجات
const QuickAddButton = () => (
  <Container className="flex items-center justify-between px-6 py-3" dir="rtl">
    <Text size="small">الاستوديو الإبداعي: صمّم الصور، أضف منتجاً، أو اكتب منشوراً، وانشره على كل المنصات الآن أو مجدولاً.</Text>
    <Button size="small" asChild>
      <a href="/app/quick-add">الاستوديو الإبداعي</a>
    </Button>
  </Container>
)

export const config = defineWidgetConfig({ zone: "product.list.before" })

export default QuickAddButton
