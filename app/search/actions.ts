"use server";

import {
  sendRequest,
  type RequestState,
} from "@/app/dashboard/request-actions";

export async function requestConnection(
  _previous: RequestState,
  form: FormData,
): Promise<RequestState> {
  return sendRequest(String(form.get("journey_id") ?? ""));
}
