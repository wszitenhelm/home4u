import Link from "next/link";
import type { ReactElement } from "react";

import { BreathingOrb } from "@/modules/branding/components/breathing-orb";

export function BrandMark(): ReactElement {
  return (
    <Link aria-label="Home4u — strona główna" className="brand-mark" href="/">
      <span className="brand-mark__orb">
        <BreathingOrb />
      </span>
      <span className="brand-mark__text">HOME4U</span>
    </Link>
  );
}
