import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData, useSearchParams, useRouteError } from "react-router";
import { authenticate } from "../../shopify.server";

function gidToNumeric(gid: string): string {
  return String(gid || "").split("/").pop() || String(gid || "");
}

const PRODUCTS_QUERY = `#graphql
query Products($first: Int!, $after: String, $query: String) {
  products(first: $first, after: $after, query: $query) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title
      featuredImage { url altText }
    }
  }
}`;

const PRODUCT_DETAIL_QUERY = `#graphql
query ProductDetail($id: ID!) {
  product(id: $id) {
    id title
    featuredImage { url altText }
    variants(first: 100) {
      nodes { id title selectedOptions { name value } }
    }
    media(first: 100) {
      nodes {
        __typename
        ... on MediaImage {
          id
          image { url altText }
        }
      }
    }
    metafield(namespace: "custom", key: "variant_media_map") { value }
  }
}`;

const PRODUCT_MAP_ONLY_QUERY = `#graphql
query ProductMapOnly($id: ID!) {
  product(id: $id) {
    id
    metafield(namespace: "custom", key: "variant_media_map") { value }
  }
}`;

const SET_METAFIELD_MUTATION = `#graphql
mutation SetMap($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    userErrors { field message }
  }
}`;

type ProductCard = {
  id: string;
  title: string;
  featuredImage?: { url: string; altText?: string | null } | null;
};

type LoaderData = {
  products: ProductCard[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  q: string;
  productId: string | null;
  variantParam: string | null;
  productTitle: string | null;
  productImageUrl: string | null;
  variants: { id: string; title: string; numericId: string }[];
  media: { id: string; numericId: number; alt: string; url: string }[];
  map: Record<string, number[]>;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (!request.headers.get("Authorization") && !url.searchParams.get("shop")) {
    throw new Response("Session token dropped by Vercel", { status: 401 });
  }

  const { admin } = await authenticate.admin(request);
  const productId = url.searchParams.get("productId");
  const variantParam = url.searchParams.get("variant");
  const cursor = url.searchParams.get("cursor");
  const q = url.searchParams.get("q") || "";
  const query = q.trim() ? `title:*${q.trim()}*` : null;

  const prodResp = await admin.graphql(PRODUCTS_QUERY, {
    variables: { first: 24, after: cursor, query },
  });
  const prodJson = await prodResp.json();
  const products = prodJson.data.products.nodes as ProductCard[];
  const pageInfo = prodJson.data.products.pageInfo as { hasNextPage: boolean; endCursor: string | null };

  if (!productId) {
    return { products, pageInfo, q, productId: null, variantParam, productTitle: null, productImageUrl: null, variants: [], media: [], map: {} } satisfies LoaderData;
  }

  const detailResp = await admin.graphql(PRODUCT_DETAIL_QUERY, { variables: { id: productId } });
  const detailJson = await detailResp.json();
  const p = detailJson.data.product;

  const variants = (p.variants.nodes as any[]).map((v) => ({ id: v.id, title: v.title, numericId: gidToNumeric(v.id) }));
  const media = (p.media.nodes as any[]).filter((m) => m.__typename === "MediaImage" && m.image?.url).map((m) => ({ id: m.id, numericId: Number(gidToNumeric(m.id)), alt: m.image?.altText || "", url: m.image.url }));

  let map: Record<string, number[]> = {};
  if (p.metafield?.value) {
    try { map = JSON.parse(p.metafield.value); } catch { map = {}; }
  }

  return { products, pageInfo, q, productId, variantParam, productTitle: p.title || null, productImageUrl: p.featuredImage?.url || null, variants, media, map } satisfies LoaderData;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "");
  if (intent !== "save") {
    return new Response(JSON.stringify({ ok: false, error: "Unknown intent" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const productId = String(form.get("productId") || "");
  const variantNumericId = String(form.get("variantNumericId") || "");
  const selected = form.getAll("mediaNumericId").map((x) => Number(x)).filter((n) => Number.isFinite(n));

  const currentResp = await admin.graphql(PRODUCT_MAP_ONLY_QUERY, { variables: { id: productId } });
  const currentJson = await currentResp.json();

  let map: Record<string, number[]> = {};
  const currentVal = currentJson?.data?.product?.metafield?.value;
  if (currentVal) {
    try { map = JSON.parse(currentVal); } catch { map = {}; }
  }

  map[variantNumericId] = selected;

  const resp = await admin.graphql(SET_METAFIELD_MUTATION, {
    variables: {
      metafields: [{ ownerId: productId, namespace: "custom", key: "variant_media_map", type: "json", value: JSON.stringify(map) }],
    },
  });

  const out = await resp.json();
  const errors = out.data?.metafieldsSet?.userErrors || [];
  if (errors.length) {
    return new Response(JSON.stringify({ ok: false, error: errors.map((e: any) => e.message).join(", ") }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ ok: true, map, variantNumericId }), { headers: { "Content-Type": "application/json" } });
};

const APP_CSS = `
  .vmf-wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

  /* Steps */
  .vmf-steps { display:flex; align-items:center; gap:8px; padding:16px 0 4px; }
  .vmf-step { display:flex; align-items:center; gap:7px; font-size:13px; color:#8c9196; font-weight:500; }
  .vmf-step.active { color:#202223; font-weight:600; }
  .vmf-step.done { color:#008060; }
  .vmf-step-num { width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; background:#f1f2f3; border:1.5px solid #c9cccf; color:#6d7175; flex-shrink:0; }
  .vmf-step.active .vmf-step-num { background:#202223; border-color:#202223; color:white; }
  .vmf-step.done .vmf-step-num { background:#008060; border-color:#008060; color:white; }
  .vmf-step-arrow { color:#c9cccf; font-size:14px; line-height:1; }

  /* Search */
  .vmf-search-wrap { position:relative; }
  .vmf-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#8c9196; pointer-events:none; }
  .vmf-search { width:100%; box-sizing:border-box; padding:10px 14px 10px 38px; font-size:14px; border:1.5px solid #c9cccf; border-radius:10px; outline:none; background:white; transition:border-color 0.2s, box-shadow 0.2s; }
  .vmf-search:focus { border-color:#202223; box-shadow:0 0 0 3px rgba(32,34,35,0.1); }
  .vmf-hint { font-size:12px; color:#8c9196; margin-top:6px; }

  /* Product Grid */
  .vmf-product-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:12px; }
  .vmf-product-card { all:unset; display:block; cursor:pointer; border:1.5px solid #e1e3e5; border-radius:14px; overflow:hidden; background:white; transition:all 0.18s ease; }
  .vmf-product-card:hover { border-color:#202223; box-shadow:0 6px 20px rgba(0,0,0,0.1); transform:translateY(-3px); }
  .vmf-product-card:active { transform:translateY(-1px); }
  .vmf-product-img-wrap { width:100%; aspect-ratio:1; overflow:hidden; background:linear-gradient(135deg,#f6f6f7,#e8eaec); display:flex; align-items:center; justify-content:center; }
  .vmf-product-img { width:100%; height:100%; object-fit:cover; display:block; }
  .vmf-product-no-img { font-size:28px; opacity:0.35; }
  .vmf-product-name { padding:10px 12px 12px; font-size:13px; font-weight:600; color:#202223; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  /* Selected Product Banner */
  .vmf-product-banner { display:flex; align-items:center; gap:14px; }
  .vmf-banner-thumb { width:52px; height:52px; border-radius:10px; overflow:hidden; background:#f6f6f7; flex-shrink:0; border:1px solid #e1e3e5; }
  .vmf-banner-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .vmf-banner-info { flex:1; min-width:0; }
  .vmf-banner-title { font-size:15px; font-weight:700; color:#202223; margin:0 0 3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .vmf-banner-sub { font-size:12px; color:#6d7175; margin:0; }
  .vmf-change-btn { all:unset; cursor:pointer; padding:8px 16px; font-size:13px; font-weight:600; border:1.5px solid #c9cccf; border-radius:8px; color:#202223; background:white; transition:all 0.15s; white-space:nowrap; }
  .vmf-change-btn:hover { background:#f6f6f7; border-color:#8c9196; }

  /* Two-col layout */
  .vmf-layout { display:grid; grid-template-columns:200px 1fr; gap:16px; align-items:start; }

  /* Variant sidebar */
  .vmf-variant-sidebar { background:#f9fafb; border-radius:12px; padding:12px; border:1.5px solid #f1f2f3; }
  .vmf-sidebar-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.6px; color:#6d7175; margin-bottom:10px; display:block; }
  .vmf-variant-btn { all:unset; display:flex; align-items:center; justify-content:space-between; width:100%; box-sizing:border-box; padding:9px 10px; border-radius:8px; cursor:pointer; font-size:13px; color:#202223; transition:all 0.15s; margin-bottom:2px; }
  .vmf-variant-btn:hover:not(.active) { background:#ebebeb; }
  .vmf-variant-btn.active { background:#202223; color:white; }
  .vmf-variant-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; }
  .vmf-variant-count { font-size:11px; padding:2px 8px; border-radius:999px; background:#e1e3e5; color:#6d7175; flex-shrink:0; margin-left:6px; }
  .vmf-variant-btn.active .vmf-variant-count { background:rgba(255,255,255,0.25); color:white; }
  .vmf-variant-btn.mapped:not(.active) .vmf-variant-count { background:#d4edda; color:#007a5e; }

  /* Image panel */
  .vmf-image-panel { display:flex; flex-direction:column; gap:14px; }
  .vmf-panel-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
  .vmf-panel-count { font-size:13px; color:#6d7175; }
  .vmf-panel-count strong { color:#202223; font-weight:700; }
  .vmf-quick-btns { display:flex; gap:8px; }
  .vmf-btn-sm { all:unset; cursor:pointer; padding:6px 12px; font-size:12px; font-weight:600; border:1.5px solid #c9cccf; border-radius:7px; color:#202223; background:white; transition:all 0.12s; }
  .vmf-btn-sm:hover { background:#f6f6f7; }

  /* Status */
  .vmf-status { font-size:13px; display:flex; align-items:center; gap:6px; }
  .vmf-status-saved { color:#008060; font-weight:600; }
  .vmf-status-error { color:#d72c0d; font-weight:600; }

  /* Image Grid */
  .vmf-img-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px; }
  .vmf-img-item { position:relative; cursor:pointer; border-radius:10px; overflow:hidden; aspect-ratio:1; border:2.5px solid transparent; transition:all 0.15s; background:#f6f6f7; }
  .vmf-img-item:hover { border-color:#b5b9bc; }
  .vmf-img-item.sel { border-color:#202223; }
  .vmf-img-item img { width:100%; height:100%; object-fit:cover; display:block; }
  .vmf-img-check { position:absolute; top:7px; right:7px; width:22px; height:22px; border-radius:50%; background:#202223; display:flex; align-items:center; justify-content:center; opacity:0; transform:scale(0.5); transition:all 0.15s; }
  .vmf-img-item.sel .vmf-img-check { opacity:1; transform:scale(1); }
  .vmf-img-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.04); opacity:0; transition:opacity 0.15s; }
  .vmf-img-item.sel .vmf-img-overlay { opacity:1; }
  .vmf-img-label { position:absolute; bottom:0; left:0; right:0; padding:6px 8px; background:linear-gradient(transparent, rgba(0,0,0,0.5)); font-size:10px; color:white; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; opacity:0; transition:opacity 0.15s; }
  .vmf-img-item:hover .vmf-img-label { opacity:1; }

  /* Save bar */
  .vmf-save-bar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:14px 0 2px; border-top:1.5px solid #f1f2f3; margin-top:4px; }
  .vmf-btn-save { all:unset; cursor:pointer; padding:10px 24px; font-size:14px; font-weight:700; border-radius:10px; background:#202223; color:white; transition:all 0.15s; border:1.5px solid #202223; }
  .vmf-btn-save:hover:not(:disabled) { background:#3a3d3e; }
  .vmf-btn-save:disabled { background:#8c9196; border-color:#8c9196; cursor:not-allowed; opacity:0.7; }

  /* Load more */
  .vmf-load-more { all:unset; display:block; width:100%; box-sizing:border-box; text-align:center; padding:12px; font-size:14px; font-weight:600; color:#202223; border:1.5px solid #e1e3e5; border-radius:10px; cursor:pointer; transition:all 0.15s; background:white; }
  .vmf-load-more:hover { background:#f6f6f7; border-color:#8c9196; }

  /* Empty state */
  .vmf-empty { text-align:center; padding:40px 20px; color:#6d7175; font-size:14px; }
  .vmf-empty-icon { font-size:40px; margin-bottom:12px; opacity:0.4; }
`;

export default function VariantImages() {
  const data = useLoaderData() as LoaderData;
  const fetcher = useFetcher<{ ok: boolean; map?: Record<string, number[]>; variantNumericId?: string; error?: string; }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [localMap, setLocalMap] = useState<Record<string, number[]>>(data.map);
  useEffect(() => { setLocalMap(data.map); }, [data.map, data.productId]);

  const selectedVariant = data.variantParam || data.variants[0]?.numericId || "";
  const [draftSelected, setDraftSelected] = useState<Set<number>>(new Set());
  useEffect(() => {
    setDraftSelected(new Set(localMap[selectedVariant] || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant, data.productId, JSON.stringify(localMap)]);

  // Update local map optimistically after save
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.map) {
      setLocalMap(fetcher.data.map);
    }
  }, [fetcher.data]);

  const isSaving = fetcher.state !== "idle";
  const step = !data.productId ? 1 : 2;

  const totalMapped = data.variants.filter(v => (localMap[v.numericId] || []).length > 0).length;

  return (
    <s-page heading="Variant Media Filter">
      <style dangerouslySetInnerHTML={{ __html: APP_CSS }} />
      <div className="vmf-wrap">

        {/* Step indicator */}
        <div className="vmf-steps">
          <div className={`vmf-step ${step === 1 ? "active" : "done"}`}>
            <div className="vmf-step-num">{step > 1 ? "✓" : "1"}</div>
            <span>Select product</span>
          </div>
          <div className="vmf-step-arrow">›</div>
          <div className={`vmf-step ${step === 2 ? "active" : ""}`}>
            <div className="vmf-step-num">2</div>
            <span>Assign images</span>
          </div>
        </div>

        {/* ─── STEP 1: Product picker ─── */}
        {!data.productId && (
          <s-card>
            <s-stack gap="400">
              <div className="vmf-search-wrap">
                <span className="vmf-search-icon">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                  </svg>
                </span>
                <input
                  className="vmf-search"
                  placeholder="Search products…"
                  defaultValue={data.q}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const val = (e.currentTarget.value || "").trim();
                    setSearchParams((prev) => {
                      if (val) prev.set("q", val); else prev.delete("q");
                      prev.delete("cursor"); prev.delete("productId"); prev.delete("variant");
                      return prev;
                    }, { preventScrollReset: true });
                  }}
                />
                <div className="vmf-hint">Press Enter to search · Showing 24 at a time</div>
              </div>

              {data.products.length === 0 ? (
                <div className="vmf-empty">
                  <div className="vmf-empty-icon">📦</div>
                  No products found. Try a different search.
                </div>
              ) : (
                <div className="vmf-product-grid">
                  {data.products.map((p) => (
                    <button
                      key={p.id}
                      className="vmf-product-card"
                      type="button"
                      onClick={() => setSearchParams((prev) => { prev.set("productId", p.id); prev.delete("variant"); prev.delete("cursor"); return prev; }, { preventScrollReset: true })}
                    >
                      <div className="vmf-product-img-wrap">
                        {p.featuredImage?.url
                          ? <img className="vmf-product-img" src={p.featuredImage.url} alt={p.featuredImage.altText || p.title} />
                          : <div className="vmf-product-no-img">🖼️</div>
                        }
                      </div>
                      <div className="vmf-product-name">{p.title}</div>
                    </button>
                  ))}
                </div>
              )}

              {data.pageInfo.hasNextPage && data.pageInfo.endCursor && (
                <button
                  className="vmf-load-more"
                  type="button"
                  onClick={() => setSearchParams((prev) => { prev.set("cursor", data.pageInfo.endCursor!); return prev; }, { preventScrollReset: true })}
                >
                  Load more products
                </button>
              )}
            </s-stack>
          </s-card>
        )}

        {/* ─── STEP 2: Selected product + variant image assignment ─── */}
        {data.productId && (
          <>
            {/* Product banner */}
            <s-card>
              <div className="vmf-product-banner">
                <div className="vmf-banner-thumb">
                  {data.productImageUrl && <img src={data.productImageUrl} alt={data.productTitle || ""} />}
                </div>
                <div className="vmf-banner-info">
                  <p className="vmf-banner-title">{data.productTitle}</p>
                  <p className="vmf-banner-sub">
                    {data.variants.length} variant{data.variants.length !== 1 ? "s" : ""} · {totalMapped} configured
                  </p>
                </div>
                <button
                  className="vmf-change-btn"
                  type="button"
                  onClick={() => setSearchParams((prev) => { prev.delete("productId"); prev.delete("variant"); return prev; }, { preventScrollReset: true })}
                >
                  ← Change
                </button>
              </div>
            </s-card>

            {/* Variant + images split layout */}
            <s-card>
              <div className="vmf-layout">
                {/* Left: variant list */}
                <div className="vmf-variant-sidebar">
                  <span className="vmf-sidebar-label">Variants</span>
                  {data.variants.map((v) => {
                    const count = (localMap[v.numericId] || []).length;
                    const isActive = selectedVariant === v.numericId;
                    return (
                      <button
                        key={v.numericId}
                        className={`vmf-variant-btn${isActive ? " active" : ""}${count > 0 ? " mapped" : ""}`}
                        type="button"
                        onClick={() => setSearchParams((prev) => { prev.set("variant", v.numericId); return prev; }, { preventScrollReset: true })}
                      >
                        <span className="vmf-variant-title">{v.title}</span>
                        <span className="vmf-variant-count">{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right: image selection */}
                <div className="vmf-image-panel">
                  <div className="vmf-panel-header">
                    <div className="vmf-panel-count">
                      <strong>{draftSelected.size}</strong> of {data.media.length} selected
                    </div>
                    <div className="vmf-quick-btns">
                      <button className="vmf-btn-sm" type="button" onClick={() => setDraftSelected(new Set(data.media.map((m) => m.numericId)))}>
                        Select all
                      </button>
                      <button className="vmf-btn-sm" type="button" onClick={() => setDraftSelected(new Set())}>
                        Clear
                      </button>
                    </div>
                  </div>

                  {data.media.length === 0 ? (
                    <div className="vmf-empty">
                      <div className="vmf-empty-icon">🖼️</div>
                      This product has no images yet.
                    </div>
                  ) : (
                    <div className="vmf-img-grid">
                      {data.media.map((m) => {
                        const isSel = draftSelected.has(m.numericId);
                        return (
                          <div
                            key={m.numericId}
                            className={`vmf-img-item${isSel ? " sel" : ""}`}
                            onClick={() => setDraftSelected((prev) => {
                              const next = new Set(prev);
                              if (isSel) next.delete(m.numericId); else next.add(m.numericId);
                              return next;
                            })}
                          >
                            <img src={m.url} alt={m.alt} loading="lazy" />
                            <div className="vmf-img-overlay" />
                            <div className="vmf-img-check">
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                            {m.alt && <div className="vmf-img-label">{m.alt}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Save bar */}
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="save" />
                    <input type="hidden" name="productId" value={data.productId} />
                    <input type="hidden" name="variantNumericId" value={selectedVariant} />
                    {Array.from(draftSelected).map((id) => (
                      <input key={id} type="hidden" name="mediaNumericId" value={String(id)} />
                    ))}
                    <div className="vmf-save-bar">
                      <button className="vmf-btn-save" type="submit" disabled={isSaving}>
                        {isSaving ? "Saving…" : "Save mapping"}
                      </button>
                      {fetcher.data?.ok && (
                        <span className="vmf-status vmf-status-saved">✓ Saved</span>
                      )}
                      {fetcher.data?.error && (
                        <span className="vmf-status vmf-status-error">✕ {fetcher.data.error}</span>
                      )}
                    </div>
                  </fetcher.Form>
                </div>
              </div>
            </s-card>
          </>
        )}
      </div>
    </s-page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  useEffect(() => {
    if (typeof window !== "undefined") window.location.reload();
  }, []);
  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
      <p style={{ color: "#666", marginBottom: "20px" }}>Restoring secure session connection...</p>
    </div>
  );
}
