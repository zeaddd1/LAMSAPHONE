import Image from "next/image"
import { t } from "@lib/i18n/ar"
import { listCategories } from "@lib/data/categories"
import { listCollections } from "@lib/data/collections"
import { Text, clx } from "@medusajs/ui"

import LocalizedClientLink from "@modules/common/components/localized-client-link"

export default async function Footer() {
  const { collections } = await listCollections({
    fields: "*products",
  })
  const productCategories = await listCategories()

  return (
    <footer className="border-t border-ui-border-base w-full">
      <div className="content-container flex flex-col w-full">
        <div className="flex flex-col gap-y-6 xsmall:flex-row items-start justify-between py-16">
          <div>
            <LocalizedClientLink
              href="/"
              className="flex items-center"
            >
              <Image src="/logo.png" alt="لمسة فون - Lamsa Phone" width={1379} height={1069} quality={100} className="h-20 w-auto" />
            </LocalizedClientLink>
          </div>
          <div className="text-small-regular gap-10 md:gap-x-16 grid grid-cols-2 sm:grid-cols-3">
            {productCategories && productCategories?.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base">
                  {t("Categories")}
                </span>
                <ul
                  className="grid grid-cols-1 gap-2"
                  data-testid="footer-categories"
                >
                  {productCategories?.slice(0, 6).map((c) => {
                    if (c.parent_category) {
                      return
                    }

                    const children =
                      c.category_children?.map((child) => ({
                        name: child.name,
                        handle: child.handle,
                        id: child.id,
                      })) || null

                    return (
                      <li
                        className="flex flex-col gap-2 text-ui-fg-subtle txt-small"
                        key={c.id}
                      >
                        <LocalizedClientLink
                          className={clx(
                            "hover:text-ui-fg-base",
                            children && "txt-small-plus"
                          )}
                          href={`/categories/${c.handle}`}
                          data-testid="category-link"
                        >
                          {c.name}
                        </LocalizedClientLink>
                        {children && (
                          <ul className="grid grid-cols-1 ms-3 gap-2">
                            {children &&
                              children.map((child) => (
                                <li key={child.id}>
                                  <LocalizedClientLink
                                    className="hover:text-ui-fg-base"
                                    href={`/categories/${child.handle}`}
                                    data-testid="category-link"
                                  >
                                    {child.name}
                                  </LocalizedClientLink>
                                </li>
                              ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {collections && collections.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <span className="txt-small-plus txt-ui-fg-base">
                  {t("Collections")}
                </span>
                <ul
                  className={clx(
                    "grid grid-cols-1 gap-2 text-ui-fg-subtle txt-small",
                    {
                      "grid-cols-2": (collections?.length || 0) > 3,
                    }
                  )}
                >
                  {collections?.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        className="hover:text-ui-fg-base"
                        href={`/collections/${c.handle}`}
                      >
                        {c.title}
                      </LocalizedClientLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-y-2">
              <span className="txt-small-plus txt-ui-fg-base">{tx.footer_title}</span>
              <ul className="grid grid-cols-1 gap-y-2 text-ui-fg-subtle txt-small">
                <li><LocalizedClientLink className="hover:text-ui-fg-base" href="/about">{tx.footer_about}</LocalizedClientLink></li>
                <li><LocalizedClientLink className="hover:text-ui-fg-base" href="/contact">{tx.footer_contact}</LocalizedClientLink></li>
                <li><LocalizedClientLink className="hover:text-ui-fg-base" href="/returns">{tx.footer_returns}</LocalizedClientLink></li>
                <li><LocalizedClientLink className="hover:text-ui-fg-base" href="/faq">{tx.footer_faq}</LocalizedClientLink></li>
                <li><LocalizedClientLink className="hover:text-ui-fg-base" href="/privacy">{tx.footer_privacy}</LocalizedClientLink></li>
                <li><LocalizedClientLink className="hover:text-ui-fg-base" href="/track-order">{tx.footer_track}</LocalizedClientLink></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="flex w-full mb-16 justify-between text-ui-fg-muted">
          <div className="flex flex-col gap-y-1 txt-compact-small">
            <span>📍 صنعاء - شارع القصر، أمام السيفي</span>
            <span>
              📲{" "}
              <a href="https://wa.me/967777128281" target="_blank" rel="noopener noreferrer" dir="ltr" className="hover:text-ui-fg-base">
                +967 777 128 281
              </a>
              {" · "}
              <a href="https://www.instagram.com/lamsaphone7/" target="_blank" rel="noopener noreferrer" dir="ltr" className="hover:text-ui-fg-base">
                Instagram @lamsaphone7
              </a>
            </span>
            <span>© {new Date().getFullYear()} {tx.footer_copyright}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
