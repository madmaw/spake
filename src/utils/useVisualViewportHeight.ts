import { useEffect, useState } from "react";

/**
 * The height of the visual viewport when it is smaller than the layout
 * viewport, or null when they match. iOS Safari overlays the keyboard on the
 * page instead of resizing it (it ignores `interactive-widget`), so the app
 * constrains itself to this height to stay fully visible above the keyboard.
 */
export function useVisualViewportHeight(): number | null {
    const [height, setHeight] = useState<number | null>(null);
    useEffect(() => {
        const viewport = window.visualViewport;
        if (viewport == null) {
            return;
        }
        const update = () => {
            const overlaid = viewport.height < window.innerHeight - 1;
            setHeight(overlaid ? viewport.height : null);
            // keep the page pinned; iOS can pan it while the keyboard opens
            if (window.scrollY !== 0) {
                window.scrollTo(0, 0);
            }
        };
        viewport.addEventListener("resize", update);
        viewport.addEventListener("scroll", update);
        return () => {
            viewport.removeEventListener("resize", update);
            viewport.removeEventListener("scroll", update);
        };
    }, []);
    return height;
}
