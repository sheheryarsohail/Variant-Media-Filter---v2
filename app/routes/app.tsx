import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Shopify's authenticate handles ALL security, tokens, and host checks natively.
  await authenticate.admin(request);

  // Failsafe: Instantly flag in Vercel logs if the environment variable is missing
  if (!process.env.SHOPIFY_API_KEY) {
    console.error("CRITICAL ERROR: SHOPIFY_API_KEY is missing in this Vercel deployment's environment variables.");
  }

  // Dynamically injects the specific deployment's API key into the frontend
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    // App Bridge will now automatically use whichever key Vercel provides in the environment
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/variant-images">Variant Images</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
