import { Outlet } from "react-router";
import type { LinksFunction } from "react-router";
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";

export const links: LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Root route renders the app routes
export default function Root() {
  return <Outlet />;
}
