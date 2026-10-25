import { SearchSkeleton } from "@/components/search-skeleton";
export default function SearchLoading() {
  return (
    <section className="search-screen bg-paper px-space-4 py-space-6 font-ui text-ink sm:px-space-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-space-6 text-h1 font-semibold">Find a traveller</h1>
        <SearchSkeleton />
      </div>
    </section>
  );
}
