import { useRef, useState, useEffect } from 'react';

const SCROLL_EDGE = 4;

export const FADE_WIDTH = 96;

export function useCardsScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const update = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeft(scrollLeft > SCROLL_EDGE);
    setShowRight(scrollLeft + clientWidth < scrollWidth - SCROLL_EDGE);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' });

  return { scrollRef, showLeft, showRight, scrollLeft, scrollRight };
}
