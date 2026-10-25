export function createClient() {
  const channel: any = {
    state: "joined",
    on: () => channel,
    subscribe: (callback: any) => {
      queueMicrotask(() => callback?.("SUBSCRIBED"));
      return channel;
    },
    presenceState: () => ({}),
    track: async () => "ok",
    untrack: async () => "ok",
    send: async () => "ok",
  };
  const query: any = {
    select: () => query,
    eq: () => query,
    in: () => query,
    then: (done: any) => Promise.resolve({ data: [], error: null }).then(done),
  };
  return {
    channel: () => channel,
    removeChannel: async () => "ok",
    from: () => query,
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({
            path,
            signedUrl: "/ticket.svg",
            error: null,
          })),
          error: null,
        }),
      }),
    },
  };
}
