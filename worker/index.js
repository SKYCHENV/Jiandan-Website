const directoryRoutes = new Set([
  "/download/",
  "/docs/quick-start/",
  "/docs/compatibility/",
  "/guides/paste-screenshot-jianying/",
  "/workflows/tutorial-videos/",
  "/workflows/graphic-to-video/",
  "/workflows/research-to-content/",
  "/compare/screenshot-import-methods/",
  "/changelog/",
  "/about/",
  "/en/",
  "/en/download/",
  "/en/docs/quick-start/",
]);

const fetchPath = (request, env, pathname) => {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = "";
  return env.ASSETS.fetch(new Request(url, request));
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    const readsHtml = acceptsHtml && ["GET", "HEAD"].includes(request.method);

    if (readsHtml && url.pathname !== "/" && !url.pathname.endsWith("/")) {
      const directoryPath = `${url.pathname}/`;
      if (directoryRoutes.has(directoryPath)) {
        const destination = new URL(request.url);
        destination.pathname = directoryPath;
        return Response.redirect(destination, 308);
      }
    }

    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404 || !readsHtml) {
      return response;
    }

    if (directoryRoutes.has(url.pathname)) {
      return fetchPath(request, env, `${url.pathname}index.html`);
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      const admin = await fetchPath(request, env, "/admin/index.html");
      const headers = new Headers(admin.headers);
      headers.set("x-robots-tag", "noindex, nofollow");
      return new Response(admin.body, {status: admin.status, statusText: admin.statusText, headers});
    }

    const notFound = await fetchPath(request, env, "/404.html");
    return new Response(notFound.body, {status: 404, headers: notFound.headers});
  },
};
