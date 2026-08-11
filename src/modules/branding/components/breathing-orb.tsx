import type { ReactElement } from "react";

const HOUSE_PATH =
  "M56.1 11.4 L81.9 34.6 Q88 40 88 48.3 L88 83.7 Q88 92 75.8 92 L24.2 92 Q12 92 12 83.7 " +
  "L12 48.3 Q12 40 18.1 34.6 L43.9 11.4 Q50 6 56.1 11.4 Z";

export function BreathingOrb(): ReactElement {
  return (
    <span aria-hidden="true" className="breathing-orb">
      <svg className="breathing-orb__svg" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="house-core" x1="15%" x2="90%" y1="5%" y2="100%">
            <stop offset="0%" stopColor="#e5efe8" />
            <stop offset="40%" stopColor="#3f7a5c" />
            <stop offset="100%" stopColor="#173126" />
          </linearGradient>
        </defs>
        <g className="breathing-orb__glow-wrap">
          <path className="breathing-orb__glow animate-house-delayed" d={HOUSE_PATH} fill="#e5efe8" />
        </g>
        <path className="breathing-orb__core animate-house" d={HOUSE_PATH} fill="url(#house-core)" />
        <ellipse className="breathing-orb__highlight" cx="38" cy="30" fill="#ffffff" rx="13" ry="9" />
      </svg>
    </span>
  );
}
