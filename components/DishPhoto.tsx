"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Long enough that no honest request is still open at this point, short
   enough that a customer is not left staring at an empty frame. Covers the
   ORB block, which reports neither load nor error, only a dead request. */
const STALLED_IMAGE_MS = 8000;

/* ------------------------------------------------------------------
   The photograph, and what stands in its place.

   Three failure modes have to look identical, because from the table
   they are the same event: a dish the kitchen has not photographed, a
   dish whose url is wrong, and a dish whose host is down or blocking
   us. All three end with the house mark in the frame.

   So the plate is a real element that is always mounted and always
   painted; the <img> is a layer on top of it, held at zero opacity
   until the bytes arrive. That ordering is what rules out the
   browser's own broken-image glyph and its alt text — the frame
   always has a face, so the browser is never asked to draw one, and
   the photograph is never visible before it is actually there.

   The three ways a photograph fails to arrive:

     1. no url at all            — never an <img>, the plate alone
     2. the request errors       — onError, fires normally
     3. ORB blocks the response  — an error too, but a *fast* one

   Case 3 is the reason this cannot be a plain onError handler. The <img>
   is server-rendered and lazy, so the browser begins fetching it while
   parsing the HTML — long before React hydrates and before onError could
   possibly be attached. An ORB block resolves in a few milliseconds;
   a plain 404 takes seconds. So the two fastest failures arrive before
   there is a listener to hear them, and the slow ones arrive after. The
   result is images that sit at opacity 0 forever with a dead frame
   still mounted over the plate — the worst of both, since the
   photograph is hidden and the frame is wasted.

   So the settled state is *reconciled* rather than *listened for*: as
   soon as React takes over, we ask the element how it went. `complete`
   means the browser has already finished with this src, and its width
   then says which way it finished. The same pass is repeated for any
   src that changes, and the element is then unmounted on failure rather
   than hidden — an errored <img> is the one element that can still
   paint alt text or the broken glyph, so it must not survive the error.
   ------------------------------------------------------------------ */
type PhotoPhase = "loading" | "ready" | "failed";

export function DishPhoto({ src, name }: { src: string; name: string }) {
  const [phase, setPhase] = useState<PhotoPhase>("loading");
  const ref = useRef<HTMLImageElement | null>(null);

  /* The fetch finished — one way or the other. Which one is on the element,
     and the element is the authority: onLoad and onError are the same event
     to us, and neither is trusted to have happened at all. */
  const settle = useCallback(() => {
    const img = ref.current;
    if (img) setPhase(img.naturalWidth > 0 ? "ready" : "failed");
  }, []);

  /* Called on hydration instead of waiting for an event, for a request
     that finished before we were listening. `complete` is the guard that
     makes this safe to call at any time: it is false while a request is
     still in flight, and an in-flight image has no width yet — so asking
     it would read as an empty picture and unmount a photograph that is
     merely still coming. */
  const reconcile = useCallback(() => {
    const img = ref.current;
    if (img && img.complete) settle();
  }, [settle]);

  /* Asked once, on hydration, for a request that finished before we were
     listening. A later change of src remounts this component instead (the
     caller keys it by src), so there is never a second settle to catch and
     no reset to schedule. */
  useEffect(() => {
    reconcile();
  }, [reconcile]);

  /* A card whose src never changes must never be able to strand itself
     on a pending load that will settle into nothing. When this src has
     now been finished for longer than a request could plausibly last,
     the request did not finish at all — a stalled or blocked fetch that
     reports neither load nor error. The element cannot come back from
     this, so it comes out of the tree and the plate takes the frame. */
  useEffect(() => {
    if (phase !== "loading") return;

    const stalled = window.setTimeout(() => {
      const img = ref.current;
      if (img && img.complete) setPhase("failed");
    }, STALLED_IMAGE_MS);

    return () => window.clearTimeout(stalled);
  }, [phase, src]);

  // Dropped from the tree entirely on failure. An <img> that has errored
  // is the one element that can still paint alt text or the broken glyph,
  // so it must not survive the error — not hidden, not transparent.
  if (phase === "failed") return null;

  return (
    <img
      ref={ref}
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      className={phase === "ready" ? "menu-card-photo is-ready" : "menu-card-photo"}
      onLoad={settle}
      onError={settle}
    />
  );
}
