import { Heading, Text } from "@medusajs/ui"
import TransferActions from "@modules/order/components/transfer-actions"
import TransferImage from "@modules/order/components/transfer-image"

export default async function TransferPage({
  params,
}: {
  params: { id: string; token: string }
}) {
  const { id, token } = params

  return (
    <div className="flex flex-col gap-y-4 items-start w-2/5 mx-auto mt-10 mb-20">
      <TransferImage />
      <div className="flex flex-col gap-y-6">
        <Heading level="h1" className="text-xl text-zinc-900">
          طلب نقل الطلب رقم {id}
        </Heading>
        <Text className="text-zinc-600">
          وصلك طلب لنقل ملكية طلبك ({id}) إلى حساب آخر. للموافقة اضغط الزر بالأسفل.
        </Text>
        <div className="w-full h-px bg-zinc-200" />
        <Text className="text-zinc-600">
          إذا وافقت، ينتقل الطلب وكل ما يتعلق به إلى الحساب الجديد.
        </Text>
        <Text className="text-zinc-600">
          إذا لم تكن تعرف هذا الطلب أو تريد الاحتفاظ به، فلا تفعل شيئاً.
        </Text>
        <div className="w-full h-px bg-zinc-200" />
        <TransferActions id={id} token={token} />
      </div>
    </div>
  )
}
