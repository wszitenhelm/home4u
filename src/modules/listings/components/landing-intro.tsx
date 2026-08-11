"use client";

import { useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { BrandMark } from "@/modules/branding/components/brand-mark";
import { INTRO_COOKIE_NAME, INTRO_DURATION_MS } from "@/modules/branding/constants";

interface LandingIntroProps {
  readonly hasSeenIntro: boolean;
  readonly children: ReactNode;
}

export function LandingIntro({ hasSeenIntro, children }: LandingIntroProps): ReactElement {
  const [isSettled, setIsSettled] = useState(hasSeenIntro);

  useEffect(() => {
    if (hasSeenIntro) {
      return;
    }

    const timer = setTimeout(() => {
      setIsSettled(true);
      document.cookie = `${INTRO_COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    }, INTRO_DURATION_MS);

    return () => clearTimeout(timer);
  }, [hasSeenIntro]);

  return (
    <div className="landing-intro">
      <div className={`landing-mark${isSettled ? " landing-mark--settled" : ""}`}>
        <BrandMark />
      </div>

      <div
        aria-hidden={!isSettled}
        className={`landing-reveal${isSettled ? " landing-reveal--visible animate-fade-in" : ""}`}
        inert={!isSettled}
      >
        {children}
      </div>
    </div>
  );
}
