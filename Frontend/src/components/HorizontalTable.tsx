import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type FloatingBar = {
  left: number;
  width: number;
  scrollWidth: number;
};

export default function HorizontalTable({ children, className = "", style }: Props) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const [floatingBar, setFloatingBar] = useState<FloatingBar | null>(null);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;

    const update = () => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLDivElement>("[data-floating-scroll-source]"),
      )
        .map((element) => ({
          element,
          rect: element.getBoundingClientRect(),
        }))
        .filter(({ element, rect }) =>
          element.scrollWidth > element.clientWidth + 1 &&
          rect.top < window.innerHeight &&
          rect.bottom > window.innerHeight
        )
        .sort((a, b) => a.rect.bottom - b.rect.bottom);
      const active = candidates[0];
      const next =
        active?.element === source
          ? {
              left: active.rect.left,
              width: active.rect.width,
              scrollWidth: source.scrollWidth,
            }
          : null;

      setFloatingBar((current) => {
        if (
          current?.left === next?.left &&
          current?.width === next?.width &&
          current?.scrollWidth === next?.scrollWidth
        ) {
          return current;
        }
        return next;
      });

      if (floatingRef.current && floatingRef.current.scrollLeft !== source.scrollLeft) {
        floatingRef.current.scrollLeft = source.scrollLeft;
      }
    };

    const syncFloating = () => {
      if (floatingRef.current) source.scrollLeft = floatingRef.current.scrollLeft;
    };
    const observer = new ResizeObserver(update);
    observer.observe(source);
    if (source.firstElementChild) observer.observe(source.firstElementChild);
    const mutations = new MutationObserver(update);
    mutations.observe(source, { childList: true, subtree: true, attributes: true });

    source.addEventListener("scroll", update, { passive: true });
    floatingRef.current?.addEventListener("scroll", syncFloating, { passive: true });
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();

    return () => {
      observer.disconnect();
      mutations.disconnect();
      source.removeEventListener("scroll", update);
      floatingRef.current?.removeEventListener("scroll", syncFloating);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <div
        ref={sourceRef}
        className={`table-wrapper ${className}`.trim()}
        style={style}
        data-floating-scroll-source
      >
        {children}
      </div>
      {floatingBar &&
        createPortal(
          <div
            ref={floatingRef}
            className="floating-horizontal-scroll"
            style={{ left: floatingBar.left, width: floatingBar.width }}
            role="region"
            aria-label="Desplazamiento horizontal de la tabla"
            tabIndex={0}
          >
            <div style={{ width: floatingBar.scrollWidth, height: 1 }} />
          </div>,
          document.body,
        )}
    </>
  );
}
