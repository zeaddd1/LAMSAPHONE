// الزوايا الأربع والتوليد اليدوي عبر حساب Gemini (منطق بحت بلا DOM، يُختبر في jest)

export const ANGLES = ["front", "back", "three_quarter", "side"] as const
export type Angle = (typeof ANGLES)[number]

export const ANGLE_LABELS: Record<Angle, string> = {
  front: "أمامي",
  back: "خلفي",
  three_quarter: "ثلاثة أرباع",
  side: "جانبي",
}
export const angleOf = (kind: string): Angle | null => {
  if (!kind.startsWith("angle_")) return null
  const a = kind.slice(6)
  return (ANGLES as readonly string[]).includes(a) ? (a as Angle) : null
}
export const isAngleKind = (kind: string) => kind.startsWith("angle_")

export const GUESS_WARNING = "هذه الزاوية مولّدة بالتخمين وقد تختلف الكاميرا والأزرار عن الجهاز الحقيقي"
export const USED_ANGLES_NOTE = "الأجهزة المستعملة: استخدم صوراً حقيقية للجهاز"
export const MANUAL_TIP = "لو رفض Gemini الصورة: جرّب صورة بدون يد أو شخص، وأزل علامة المورد بأداة منفصلة قبل الرفع، وولّد صورة واحدة في كل رسالة"

// الخلفي والجانبي بلا صورة حقيقية مرفوعة لنفس الزاوية = تخمين
export function isGuessedAngle(angle: Angle, uploadKinds: string[]) {
  if (angle === "back") return !uploadKinds.includes("back")
  if (angle === "side") return !uploadKinds.includes("side")
  return false
}

export type ManualPromptInput = { deviceName: string; color?: string; parts?: string; styleText: string }

const ONE = "Output exactly one single image, not a collage or grid."

// البرومتات الأربعة للتوليد اليدوي. تُبنى فقط من: اسم الجهاز، اللون، وصف الأجزاء، النمط.
// لا تكلفة ولا مورد ولا IMEI.
export function buildManualPrompts(i: ManualPromptInput): string[] {
  const name = i.deviceName.trim() || "smartphone"
  const color = i.color?.trim() || "as in the reference photo"
  const parts = i.parts?.trim() || "camera layout, buttons and ports exactly as in the reference photo"
  return [
    [
      "I am creating a consistent set of 4 separate e-commerce product photos of the same smartphone, one image at a time. Use the attached photo as the reference for the real device.",
      `Product: ${name}`,
      `Color: ${color}`,
      `Details to keep exactly: ${parts}`,
      `Fixed style for ALL images in the set: ${i.styleText}, the phone centered, sharp, high resolution, same framing and scale, square 1:1 composition.`,
      `Keep the phone's design, proportions, colors and details exactly as in the reference. Do not invent text or logos. ${ONE}`,
      "Generate image 1 of 4 now: FRONT VIEW. The phone facing straight at the camera, screen on, perfectly centered and upright.",
    ].join("\n"),
    `Now generate image 2 of 4, as a separate single image, same device, same style, same background and lighting: BACK VIEW. The phone showing its back panel straight to the camera, perfectly centered and upright, camera module clearly visible. ${ONE}`,
    `Now generate image 3 of 4, as a separate single image, same device, same style, same background and lighting: THREE-QUARTER VIEW. The phone rotated about 30 to 40 degrees showing the front and the side edge together, slightly angled, with a soft shadow. ${ONE}`,
    `Now generate image 4 of 4, as a separate single image, same device, same style, same background and lighting: SIDE VIEW. The phone seen from its right edge, showing the thickness, buttons and frame clearly, upright and centered. ${ONE}`,
  ]
}

// متى تظهر بطاقة "التوليد اليدوي عبر Gemini" تلقائياً: المفتاح غير موجود، الاختبار فشل،
// أو فشل التوليد (حد الاستخدام، رفض متكرر، شبكة) في المهمة
export function shouldOfferManual(
  gemini: { has_key: boolean; status: string } | null,
  job?: { status: string; images: { kind: string; status: string; source?: string }[] } | null
): boolean {
  if (!gemini || !gemini.has_key || gemini.status === "error") return true
  if (!job) return false
  if (job.status === "failed" && !job.images.some((i) => i.status === "done")) return true
  return job.images.some((i) => isAngleKind(i.kind) && i.source !== "manual" && i.status === "failed")
}
