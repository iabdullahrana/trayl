export type SignedMedia = { url?: string; error?: string; expiresAt: number };
type Signer = {
  createSignedUrls: (
    paths: string[],
    seconds: number,
    options: { download: boolean },
  ) => PromiseLike<{
    data:
      | {
          path: string | null;
          signedUrl: string | null;
          error: string | null;
        }[]
      | null;
    error: unknown;
  }>;
};
export async function refreshSignedMedia(
  cache: Map<string, SignedMedia>,
  types: Map<string, string>,
  visible: string[],
  signer: Signer,
  now: () => number = Date.now,
) {
  const needed = [...new Set(visible)].filter(
    (path) =>
      types.has(path) && (cache.get(path)?.expiresAt ?? 0) <= now() + 60_000,
  );
  for (const download of [false, true]) {
    const group = needed.filter(
      (path) => (types.get(path) === "document") === download,
    );
    for (let index = 0; index < group.length; index += 50) {
      const batch = group.slice(index, index + 50);
      try {
        const { data, error } = await signer.createSignedUrls(batch, 3600, {
          download,
        });
        const entries = new Map((data ?? []).map((item) => [item.path, item]));
        for (const path of batch) {
          const item = entries.get(path);
          cache.set(
            path,
            !error && !item?.error && item?.signedUrl
              ? { url: item.signedUrl, expiresAt: now() + 3600_000 }
              : {
                  error: "Media unavailable. Retry to reload it.",
                  expiresAt: now() + 120_000,
                },
          );
        }
      } catch {
        for (const path of batch)
          cache.set(path, {
            error: "Could not load private media. Check your connection.",
            expiresAt: now() + 120_000,
          });
      }
    }
  }
  return Object.fromEntries(cache);
}
