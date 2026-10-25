import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/server";
import { uuidPattern } from "@/lib/chat/types";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: { reportId: string } },
) {
  const { supabase } = await requireAdmin();
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  if (!uuidPattern.test(params.reportId))
    return new NextResponse("Invalid report", { status: 400, headers });
  try {
    const { data, error } = await supabase.rpc("admin_report_message", {
      report_id: params.reportId,
    });
    if (error)
      return new NextResponse("Unable to load reported attachment", {
        status: 503,
        headers,
      });
    const message = data?.[0];
    if (!message?.media_path)
      return new NextResponse("No attachment on an open report", {
        status: 404,
        headers,
      });
    // Storage RLS also checks admin role and an open report for this exact path.
    const signed = await supabase.storage
      .from("chat-media")
      .createSignedUrl(message.media_path, 60, {
        download: message.media_name || true,
      });
    if (signed.error || !signed.data?.signedUrl)
      return new NextResponse("Unable to open attachment. Please retry.", {
        status: 503,
        headers,
      });
    return NextResponse.redirect(signed.data.signedUrl, {
      status: 302,
      headers,
    });
  } catch {
    return new NextResponse(
      "Unable to open attachment. Check your connection and retry.",
      { status: 503, headers },
    );
  }
}
