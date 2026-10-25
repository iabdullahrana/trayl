import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/user";
import { todayUTC } from "@/lib/journeys/validation";
import { JourneyForm } from "@/components/journey-form";

export const metadata: Metadata = { title: "Post a journey | Trayl" };

export default async function PostJourneyPage() {
  await requireUser();
  return <JourneyForm today={todayUTC()} />;
}
