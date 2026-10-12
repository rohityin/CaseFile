import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "motion/react";

gsap.registerPlugin(ScrollTrigger);

interface ImageScaleFadeProps {
  src: string;
  alt: string;
  caption?: string;
}

export function ImageScaleFade({ src, alt, caption }: ImageScaleFadeProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce || !wrap.current) return;
    const img = wrap.current.querySelector("img");
    if (!img) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        img,
        { scale: 0.9, opacity: 0.7 },
        {
          scale: 1,
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: wrap.current,
            start: "top 85%",
            end: "center center",
            scrub: 1,
          },
        }
      );
    }, wrap);

    return () => ctx.revert();
  }, [reduce, src]);

  return (
    <div className="gsap-media" ref={wrap}>
      <div className="gsap-media-frame">
        <img src={src} alt={alt} width={1400} height={900} />
      </div>
      {caption ? <p className="gsap-media-caption">{caption}</p> : null}
    </div>
  );
}
