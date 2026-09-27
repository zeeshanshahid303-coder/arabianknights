"use client";

import { useEffect, useRef } from "react";

/**
 * Attaches an IntersectionObserver to the returned ref.
 * When the element enters the viewport, the class `is-visible` is added,
 * which triggers the CSS reveal transition defined in globals.css.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  delay = 0,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const timeout = setTimeout(() => {
            el.classList.add("is-visible");
          }, delay);
          observer.disconnect();
          return () => clearTimeout(timeout);
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return ref;
}
