import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Variant Media Filter</h1>
        <p className={styles.text}>
          Show the right product images for every variant. Assign specific
          images to each variant and they'll automatically filter on your
          storefront.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Variant-specific media</strong>. Assign images to individual
            variants so customers only see what's relevant.
          </li>
          <li>
            <strong>Universal theme support</strong>. Works with Dawn, Horizon,
            Craft, Sense, and virtually any Shopify theme.
          </li>
          <li>
            <strong>Zero performance impact</strong>. Mappings are stored as
            product metafields — no external API calls on the storefront.
          </li>
        </ul>
      </div>
    </div>
  );
}
