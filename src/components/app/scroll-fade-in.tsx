
'use client';

import React, { useEffect, useRef, ReactNode, RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollFadeInProps {
  children: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement>;
  containerClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
}

const ScrollFadeIn: React.FC<ScrollFadeInProps> = ({
  children,
  scrollContainerRef,
  containerClassName = '',
  animationDuration = 1.2,
  ease = 'expo.out',
  scrollStart = 'top bottom-=20%',
  scrollEnd = 'bottom top',
  stagger = 0.1
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const scroller = scrollContainerRef && scrollContainerRef.current ? scrollContainerRef.current : window;
    
    gsap.fromTo(
      el,
      {
        willChange: 'opacity, transform',
        opacity: 0,
        y: 60,
      },
      {
        duration: animationDuration,
        ease: ease,
        opacity: 1,
        y: 0,
        stagger: stagger,
        scrollTrigger: {
          trigger: el,
          scroller,
          start: scrollStart,
          end: scrollEnd,
          scrub: false,
          toggleActions: "play none none none"
        }
      }
    );
  }, [scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger]);

  return (
    <div ref={containerRef} className={containerClassName}>
      {children}
    </div>
  );
};

export default ScrollFadeIn;
