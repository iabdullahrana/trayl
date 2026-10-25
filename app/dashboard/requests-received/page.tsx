import { getRequests } from "@/lib/requests/dashboard";
import { RequestList } from "@/components/request-list";
import { ListPagination } from "@/components/list-pagination";
import { pageNumber } from "@/lib/pagination";
export default async function RequestsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = pageNumber(searchParams.page);
  const rows = await getRequests("received", page);
  return (
    <>
      <RequestList requests={rows.slice(0, 20)} direction="received" />
      <ListPagination page={page} hasMore={rows.length > 20} />
    </>
  );
}
