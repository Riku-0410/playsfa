"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * バック/フォワード時のスクロール位置復元。
 * 保存アクションで revalidatePath した後の router.back() は、再取得中の
 * 短いコンテンツに対してNext標準の復元が走ってクランプされるため、
 * URLごとの scrollY を sessionStorage に記録し、popstate 後に
 * コンテンツの高さが足りた時点で復元し直す。
 */
export function ScrollRestorer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const popped = useRef(false);
  const key = `scroll:${pathname}?${searchParams}`;

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    let t: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        sessionStorage.setItem(
          `scroll:${location.pathname}${location.search}`,
          String(Math.round(window.scrollY)),
        );
      }, 100);
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!popped.current) return;
    popped.current = false;
    const y = Number(sessionStorage.getItem(key));
    if (!Number.isFinite(y) || y <= 0) return;
    const started = Date.now();
    const tryRestore = () => {
      const maxY = document.documentElement.scrollHeight - window.innerHeight;
      if (maxY >= y || Date.now() - started > 3000) {
        window.scrollTo(0, Math.min(y, Math.max(maxY, 0)));
        return;
      }
      requestAnimationFrame(tryRestore);
    };
    requestAnimationFrame(tryRestore);
  }, [key]);

  return null;
}
