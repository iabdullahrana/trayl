import { requireUser } from "@/lib/auth/user";
import { MessagesInbox } from "@/components/messages-inbox";
export default async function MessagesPage() {
  await requireUser();
  return <MessagesInbox />;
}
