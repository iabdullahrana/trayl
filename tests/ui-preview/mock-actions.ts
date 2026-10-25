"use server";
// Synthetic actions only: this isolated preview never connects to Supabase.
async function delay() {
  await new Promise((resolve) => setTimeout(resolve, 2500));
}
export async function login() {
  await delay();
  return { error: "Preview: the email or password is incorrect." };
}
export async function signup() {
  await delay();
  return { error: "Preview: this email is already registered." };
}
export async function postJourney(_state: unknown, form: FormData) {
  await delay();
  return form.get("from_city") === "Error"
    ? { error: "Preview: unable to save the journey." }
    : { success: true, firstMoment: true };
}
export async function requestConnection() {
  await delay();
  return { error: "Preview: unable to send your request." };
}
export async function respondToRequest() {
  await delay();
  return { success: "Request accepted." };
}
export async function cancelJourney() {
  await delay();
  return { error: "Preview: unable to cancel this journey." };
}
export async function runAdminAction() {
  await delay();
  return { error: "Preview: this action could not be completed." };
}

export async function loadMessages() {
  return { messages: [], hasMore: false };
}
export async function sendMessage() {
  return { error: "Preview: message was not sent." };
}
export async function markChatRead() {
  return { readAt: new Date().toISOString() };
}
export async function loadChatSafety() {
  return { state: "available" };
}
export async function blockChatUser() {
  return { success: true };
}
export async function reportChat() {
  return { success: true };
}
export async function sendMediaMessage() {
  return { error: "Preview upload is disabled." };
}
export async function cleanupMediaUpload() {
  return { success: true };
}
export async function loadHandover() {
  return {
    handover: {
      mine: true,
      theirs: true,
      completedAt: "2026-10-03T12:00:00Z",
      from: "Jaipur",
      to: "Gurgaon",
      date: "2099-10-10",
    },
  };
}
export async function confirmHandover() {
  return loadHandover();
}
export async function claimHandoverMoment() {
  return { firstMoment: true };
}
export async function moderateReport() {
  return { error: "Preview moderation is disabled." };
}

export async function logout() {
  return { success: true };
}
