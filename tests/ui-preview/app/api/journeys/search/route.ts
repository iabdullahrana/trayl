import { NextResponse } from "next/server";
import { journey } from "../../../../data";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return NextResponse.json({
    journeys:
      params.get("from") === "NoMatches"
        ? []
        : [
            {
              ...journey,
              from_city: params.get("from") || journey.from_city,
              to_city: params.get("to") || journey.to_city,
              travel_date: params.get("date") || journey.travel_date,
            },
          ],
  });
}
