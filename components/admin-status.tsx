import { Badge, type BadgeStatus } from "@/components/ui/Badge";
const statuses: Record<string, BadgeStatus> = {
  active: "active",
  inactive: "inactive",
  pending: "pending",
  accepted: "accepted",
  declined: "declined",
  completed: "completed",
  cancelled: "cancelled",
  open: "open",
  reviewed: "reviewed",
};
export function AdminStatus({ status }: { status: string }) {
  return <Badge variant={statuses[status] ?? "completed"}>{status}</Badge>;
}
