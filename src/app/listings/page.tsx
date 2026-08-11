import { ListingsView } from "@/modules/listings/components/listings-view";

interface ListingsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default function ListingsPage({
  searchParams,
}: ListingsPageProps): React.JSX.Element {
  return <ListingsView searchParams={searchParams} />;
}
