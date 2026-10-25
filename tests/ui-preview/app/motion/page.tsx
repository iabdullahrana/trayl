"use client";
import { useState } from "react";
import { AnimatedCount } from "@/components/ui/AnimatedCount";
import { Button } from "@/components/ui/Button";
import { SearchSkeleton } from "@/components/search-skeleton";
export default function Page() {
  const [count, setCount] = useState(1);
  return (
    <section className="bg-paper p-space-4">
      <p data-testid="count">
        <AnimatedCount value={count} />
      </p>
      <Button onClick={() => setCount((c) => c + 8)}>Change count</Button>
      <SearchSkeleton />
    </section>
  );
}
