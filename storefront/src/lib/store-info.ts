/**
 * البيانات الرسمية للمتجر في مكان واحد. أي تغيير في الرقم أو العنوان يُعدَّل هنا فقط،
 * ويظهر في الزر العائم، أزرار "اطلب عبر واتساب"، الفوتر، صفحة تواصل معنا، وبيانات محركات البحث.
 */
export const STORE = {
  name: "لمسة فون للهواتف الذكية",
  shortName: "لمسة فون",
  nameEn: "Lamsa Phone",
  tagline: "جوالات سامسونج وارد أمريكا (نظافة وكالة وفحص شامل) وإكسسوارات أصلية",
  // رقم الهاتف والواتساب الرسمي، بالصيغة الدولية بدون +
  whatsapp: "967777128281",
  phoneDisplay: "+967 777 128 281",
  address: "صنعاء - شارع القصر، أمام السيفي",
  city: "صنعاء",
  country: "YE",
  instagram: "https://www.instagram.com/lamsaphone7/",
  instagramHandle: "@lamsaphone7",
  facebook: "https://www.facebook.com/1166805176524724",
  url: "https://lamsaphone.yemenbay.com",
} as const

/** رقم الواتساب: الثابت الرسمي أولاً. متغير البيئة القديم لا يُستخدم حتى لا يعود الرقم السابق. */
export const whatsappNumber = (): string => STORE.whatsapp

export const whatsappLink = (text?: string): string =>
  `https://wa.me/${STORE.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`
