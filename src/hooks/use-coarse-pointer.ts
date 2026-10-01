import { useEffect, useState } from "react";

const COARSE = "(hover: none), (pointer: coarse)";

/**
 * True when the primary input is a finger rather than a mouse.
 *
 * Radix tooltips only open on hover or focus, and mobile browsers do not focus
 * a button when it is tapped, so on a phone an image tooltip never appears at
 * all. A touch surface has to be tap-driven instead, and that needs a
 * different trigger from the hover behaviour a mouse wants.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(
    () => typeof window !== "undefined" && window.matchMedia(COARSE).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(COARSE);
    const sync = () => setCoarse(mq.matches);
    // Re-read on mount: the media query can differ from the first render if the
    // device changed input mode while the app was backgrounded.
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return coarse;
}
