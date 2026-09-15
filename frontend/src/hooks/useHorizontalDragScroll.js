import { useEffect } from "react";

export default function useHorizontalDragScroll() {
  useEffect(() => {
    let drag = null;
    let dragged = false;

    const onPointerDown = (event) => {
      if (event.button !== 0 || event.target.closest("button, a, input, select, textarea, [role='button']")) return;
      const area = event.target.closest(".overflow-x-auto:not(.list-scroll-area)");
      if (!area || area.scrollWidth <= area.clientWidth) return;
      drag = { area, pointerId: event.pointerId, x: event.clientX, scrollLeft: area.scrollLeft };
      dragged = false;
      area.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const distance = event.clientX - drag.x;
      if (Math.abs(distance) > 4) {
        dragged = true;
        drag.area.classList.add("cursor-grabbing", "select-none");
        event.preventDefault();
      }
      drag.area.scrollLeft = drag.scrollLeft - distance;
    };

    const stopDrag = (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.area.classList.remove("cursor-grabbing", "select-none");
      drag = null;
    };

    const stopDraggedClick = (event) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
      dragged = false;
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", stopDrag);
    document.addEventListener("pointercancel", stopDrag);
    document.addEventListener("click", stopDraggedClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", stopDrag);
      document.removeEventListener("pointercancel", stopDrag);
      document.removeEventListener("click", stopDraggedClick, true);
    };
  }, []);
}
