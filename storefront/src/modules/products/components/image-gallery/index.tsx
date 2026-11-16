import { HttpTypes } from "@medusajs/types"
import { Container } from "@medusajs/ui"
import Image from "next/image"

type ProductVideo = { url: string; poster?: string }

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
  // فيديوهات المنتج من الإضافة السريعة (metadata.videos): تظهر بعد الصورة الرئيسية
  videos?: ProductVideo[]
}

// صور المنتج بمقاس 1200×1400، فالإطار بنفس النسبة (6:7) لتملأه الصورة كاملة
const BOX = "relative aspect-[6/7] w-full overflow-hidden bg-white"

const ImageGallery = ({ images, videos = [] }: ImageGalleryProps) => {
  // ترتيب العرض: الصورة الرئيسية، ثم الفيديو، ثم باقي الصور
  const items: ({ kind: "image"; image: HttpTypes.StoreProductImage; index: number } | { kind: "video"; video: ProductVideo })[] = []
  images.forEach((image, index) => {
    items.push({ kind: "image", image, index })
    if (index === 0) videos.forEach((video) => items.push({ kind: "video", video }))
  })
  if (!images.length) videos.forEach((video) => items.push({ kind: "video", video }))

  return (
    <div className="flex items-start relative">
      <div className="flex flex-col flex-1 small:mx-16 gap-y-4">
        {items.map((item, k) =>
          item.kind === "video" ? (
            <Container key={`video-${k}`} className={BOX}>
              <video
                src={item.video.url}
                poster={item.video.poster}
                className="absolute inset-0 h-full w-full rounded-rounded object-cover"
                controls
                muted
                playsInline
                loop
                autoPlay
                preload="metadata"
              />
            </Container>
          ) : (
            <Container key={item.image.id} className={BOX} id={item.image.id}>
              {!!item.image.url && (
                <Image
                  src={item.image.url}
                  priority={item.index <= 2}
                  className="absolute inset-0 rounded-rounded"
                  alt={`Product image ${item.index + 1}`}
                  fill
                  sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
                  style={{ objectFit: "cover" }}
                />
              )}
            </Container>
          )
        )}
      </div>
    </div>
  )
}

export default ImageGallery
