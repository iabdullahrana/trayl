"use client";

// The Storage SDK still constructs/authenticates the upload. XHR supplies real
// byte progress, which native fetch does not expose for request bodies.
export function uploadFetch(
  onProgress: (percent: number) => void,
): typeof fetch {
  return (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : "";
    if (
      !url.includes("/storage/v1/object/chat-media/") ||
      init?.method?.toUpperCase() !== "POST" ||
      !(init.body instanceof FormData || init.body instanceof Blob)
    )
      return fetch(input, init);
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const finish = () => init.signal?.removeEventListener("abort", abort);
      xhr.open("POST", url);
      xhr.timeout = 120000;
      new Headers(init.headers).forEach((value, key) =>
        xhr.setRequestHeader(key, value),
      );
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress(
            Math.min(99, Math.round((event.loaded / event.total) * 100)),
          );
      };
      xhr.onload = () => {
        finish();
        const headers = new Headers();
        xhr
          .getAllResponseHeaders()
          .trim()
          .split(/[\r\n]+/)
          .forEach((line) => {
            const i = line.indexOf(":");
            if (i > 0)
              headers.append(line.slice(0, i), line.slice(i + 1).trim());
          });
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers,
          }),
        );
      };
      xhr.onerror = xhr.ontimeout = () => {
        finish();
        reject(new TypeError("Upload connection failed."));
      };
      xhr.onabort = () => {
        finish();
        reject(new DOMException("Upload cancelled", "AbortError"));
      };
      if (init.signal?.aborted) {
        reject(new DOMException("Upload cancelled", "AbortError"));
        return;
      }
      init.signal?.addEventListener("abort", abort, { once: true });
      xhr.send(init.body as XMLHttpRequestBodyInit);
    });
  };
}
// Share the existing browser auth client; do not create parallel auth clients.
const listeners = new Map<string, (percent: number) => void>();
export function trackUploadProgress(
  path: string,
  listener: (percent: number) => void,
) {
  listeners.set(path, listener);
  return () => {
    listeners.delete(path);
  };
}
export const storageFetch: typeof fetch = (input, init) => {
  const url =
    typeof input === "string" ? input : input instanceof URL ? input.href : "";
  const path = url.split("/storage/v1/object/chat-media/")[1]?.split("?")[0];
  const listener = path ? listeners.get(decodeURIComponent(path)) : undefined;
  return listener ? uploadFetch(listener)(input, init) : fetch(input, init);
};
