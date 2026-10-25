import { fileURLToPath } from "node:url";
const file = (name) => fileURLToPath(new URL(name, import.meta.url));
const actions = [
  "auth-actions",
  "post-journey/actions",
  "search/actions",
  "dashboard/request-actions",
  "dashboard/journey-actions",
  "admin/actions",
  "admin/report-actions",
  "chat/actions",
  "chat/safety-actions",
  "chat/media-actions",
  "chat/handover-actions",
];
const mocks = Object.fromEntries(
  actions.map((name) => [`@/app/${name}`, file("./mock-actions.ts")]),
);
for (const name of [
  "auth/user",
  "home/overview",
  "requests/dashboard",
  "supabase/server",
  "supabase/config",
  "journeys/search-server",
])
  mocks[`@/lib/${name}`] = file("./mock-server.ts");
mocks["@/lib/supabase/client"] = file("./mock-client.ts");
mocks["@/components/chat-inbox-provider"] = file("./mock-inbox.tsx");
export default {
  experimental: { externalDir: true },
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^@\//, (resource) => {
        if (mocks[resource.request]) resource.request = mocks[resource.request];
      }),
    );
    Object.assign(config.resolve.alias, mocks);
    return config;
  },
};
