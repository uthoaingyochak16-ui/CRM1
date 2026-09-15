import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A horizontally scrollable list with a second scrollbar pinned to the bottom
 * of the visible admin area. Ctrl + mouse-wheel also scrolls it sideways.
 */
export default function ListScrollArea({ children, className = "" }) {
  const viewportRef = useRef(null);
  const bottomBarRef = useRef(null);
  const syncingRef = useRef(false);
  const dragRef = useRef(null);
  const draggedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [bar, setBar] = useState({ visible: false, left: 0, width: 0, contentWidth: 0 });

  const updateBar = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const overflowing = viewport.scrollWidth > viewport.clientWidth + 1;
    const intersectsScreen = rect.bottom > 0 && rect.top < window.innerHeight;

    setBar({
      visible: overflowing && intersectsScreen,
      left: Math.max(0, rect.left),
      width: Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(0, rect.left)),
      contentWidth: viewport.scrollWidth,
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const onWheel = (event) => {
      if (!event.ctrlKey || viewport.scrollWidth <= viewport.clientWidth) return;
      event.preventDefault();
      const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      viewport.scrollLeft += amount;
    };

    const observer = new ResizeObserver(updateBar);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    viewport.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", updateBar);
    window.addEventListener("scroll", updateBar, true);
    updateBar();

    return () => {
      observer.disconnect();
      viewport.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", updateBar);
      window.removeEventListener("scroll", updateBar, true);
    };
  }, [updateBar]);

  const syncScroll = (source, target) => {
    if (syncingRef.current || !target) return;
    syncingRef.current = true;
    target.scrollLeft = source.scrollLeft;
    requestAnimationFrame(() => { syncingRef.current = false; });
  };

  const startDrag = (event) => {
    const viewport = viewportRef.current;
    if (event.button !== 0 || !viewport || viewport.scrollWidth <= viewport.clientWidth) return;
    if (event.target.closest("button, a, input, select, textarea, [role='button']")) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, scrollLeft: viewport.scrollLeft };
    draggedRef.current = false;
    viewport.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.x;
    if (Math.abs(distance) > 4) {
      draggedRef.current = true;
      setDragging(true);
      event.preventDefault();
    }
    viewportRef.current.scrollLeft = drag.scrollLeft - distance;
  };

  const stopDrag = (event) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <>
      <div
        ref={viewportRef}
        className={`list-scroll-area overflow-x-auto ${dragging ? "cursor-grabbing select-none" : "cursor-grab"} ${className}`}
        onScroll={(event) => syncScroll(event.currentTarget, bottomBarRef.current)}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClickCapture={(event) => {
          if (!draggedRef.current) return;
          event.preventDefault();
          event.stopPropagation();
          draggedRef.current = false;
        }}
      >
        {children}
      </div>
      {bar.visible && (
        <div
          ref={bottomBarRef}
          className="fixed bottom-0 z-40 h-4 overflow-x-auto overflow-y-hidden bg-white/95 shadow-[0_-1px_3px_rgba(15,23,42,0.12)]"
          style={{ left: bar.left, width: bar.width }}
          onScroll={(event) => syncScroll(event.currentTarget, viewportRef.current)}
          aria-label="List horizontal scrollbar"
        >
          <div style={{ width: bar.contentWidth, height: 1 }} />
        </div>
      )}
    </>
  );
}
