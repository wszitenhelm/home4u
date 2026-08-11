import { cookies } from "next/headers";

import { INTRO_COOKIE_NAME } from "@/modules/branding/constants";
import { LandingIntro } from "@/modules/listings/components/landing-intro";
import { ListingsView } from "@/modules/listings/components/listings-view";

export const dynamic = "force-dynamic";

export default async function HomePage(): Promise<React.JSX.Element> {
  const cookieStore = await cookies();
  const hasSeenIntro = cookieStore.get(INTRO_COOKIE_NAME)?.value === "1";

  return (
    <LandingIntro hasSeenIntro={hasSeenIntro}>
      <ListingsView searchParams={Promise.resolve({})} />
    </LandingIntro>
  );
}
