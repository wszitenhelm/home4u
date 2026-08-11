import Link from "next/link";
import type { ReactElement } from "react";

import { BreathingOrb } from "@/modules/branding/components/breathing-orb";

export function BrandMark(): ReactElement {
  return (
    <Link aria-label="Prodomy — strona główna" className="brand-mark" href="/">
      <span className="brand-mark__orb">
        <BreathingOrb />
      </span>
      <span className="brand-mark__text">PRODOMY</span>
    </Link>
  );
}
