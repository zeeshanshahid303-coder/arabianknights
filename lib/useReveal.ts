"use client";

import { useEffect, useRef } from "react";

/**
 * Attaches an IntersectionObserver to the returned ref.
 * When the element enters the viewport, the class `is-visible` is added,
 * which triggers the CSS reveal transition defined in globals.css. The
 * observer disconnects on the first intersection, so each element reveals
 * exactly once. Stagger a group by giving each element its own
 * `transitionDelay` inline style rather than a per-element delay here.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(): React.RefObject<
  T | null
> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // console.log("Reveal element", el.className, "isIntersecting:", entry.isIntersecting, "intersectionRatio:", entry.intersectionRatio);
        if (!entry.isIntersecting) return;
        observer.disconnect();
        el.classList.add("is-visible");
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      el.classList.remove("is-visible");
    };
  }, []);

  return ref;
}
