import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const HOME_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  .vmf-home { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 680px; }

  .vmf-hero { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); border-radius: 16px; padding: 40px; color: white; position: relative; overflow: hidden; margin-bottom: 20px; }
  .vmf-hero::before { content: ''; position: absolute; top: -60px; right: -60px; width: 240px; height: 240px; background: rgba(255,255,255,0.04); border-radius: 50%; }
  .vmf-hero::after { content: ''; position: absolute; bottom: -80px; right: 60px; width: 180px; height: 180px; background: rgba(255,255,255,0.03); border-radius: 50%; }
  .vmf-hero-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.12); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.15); border-radius: 999px; padding: 5px 14px; font-size: 12px; font-weight: 600; letter-spacing: 0.3px; color: rgba(255,255,255,0.9); margin-bottom: 20px; }
  .vmf-hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 6px #4ade80; }
  .vmf-hero h1 { font-size: 28px; font-weight: 700; margin: 0 0 10px; line-height: 1.2; }
  .vmf-hero p { font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.75); margin: 0 0 28px; max-width: 460px; }
  .vmf-hero-btn { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; background: white; color: #1a1a2e; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 10px; transition: all 0.2s; position: relative; z-index: 1; }
  .vmf-hero-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
  .vmf-hero-btn:active { transform: translateY(0); }
  .vmf-hero-btn svg { transition: transform 0.2s; }
  .vmf-hero-btn:hover svg { transform: translateX(3px); }

  .vmf-steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .vmf-step-card { background: white; border: 1.5px solid #e8eaec; border-radius: 14px; padding: 20px; }
  .vmf-step-icon { font-size: 26px; margin-bottom: 12px; display: block; }
  .vmf-step-num-badge { display: inline-block; font-size: 11px; font-weight: 700; color: #6d7175; background: #f1f2f3; border-radius: 6px; padding: 2px 8px; margin-bottom: 8px; }
  .vmf-step-title { font-size: 13px; font-weight: 700; color: #202223; margin: 0 0 5px; }
  .vmf-step-desc { font-size: 12px; color: #6d7175; line-height: 1.5; margin: 0; }

  .vmf-tips { background: #f9fafb; border: 1.5px solid #e8eaec; border-radius: 14px; padding: 20px; margin-bottom: 20px; }
  .vmf-tips-title { font-size: 13px; font-weight: 700; color: #202223; margin: 0 0 14px; display: flex; align-items: center; gap: 7px; }
  .vmf-tip { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
  .vmf-tip:last-child { margin-bottom: 0; }
  .vmf-tip-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .vmf-tip-text { font-size: 13px; color: #6d7175; line-height: 1.5; }
  .vmf-tip-text strong { color: #202223; }

  .vmf-themes { background: white; border: 1.5px solid #e8eaec; border-radius: 14px; padding: 20px; }
  .vmf-themes-title { font-size: 13px; font-weight: 700; color: #202223; margin: 0 0 14px; display: flex; align-items: center; gap: 7px; }
  .vmf-themes-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .vmf-theme-tag { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; background: #f6f6f7; border: 1px solid #e8eaec; border-radius: 999px; font-size: 12px; font-weight: 500; color: #202223; }
  .vmf-theme-tag-dot { width: 5px; height: 5px; border-radius: 50%; background: #4ade80; }
`;

export default function Index() {
  const navigate = useNavigate();

  return (
    <s-page heading="Variant Media Filter">
      <style dangerouslySetInnerHTML={{ __html: HOME_CSS }} />
      <div className="vmf-home">

        {/* Hero */}
        <div className="vmf-hero">
          <div className="vmf-hero-badge">
            <div className="vmf-hero-badge-dot" />
            Active
          </div>
          <h1>Show the right images<br />for every variant</h1>
          <p>
            Assign specific product images to each variant. When a customer selects a variant, only the relevant images appear — no clutter, no confusion.
          </p>
          <button className="vmf-hero-btn" type="button" onClick={() => navigate("/app/variant-images")}>
            Go to Variant Images
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* How it works */}
        <div className="vmf-steps-grid">
          <div className="vmf-step-card">
            <span className="vmf-step-icon">📦</span>
            <div className="vmf-step-num-badge">Step 1</div>
            <p className="vmf-step-title">Pick a product</p>
            <p className="vmf-step-desc">Search and select the product you want to configure from your catalog.</p>
          </div>
          <div className="vmf-step-card">
            <span className="vmf-step-icon">🎛️</span>
            <div className="vmf-step-num-badge">Step 2</div>
            <p className="vmf-step-title">Select a variant</p>
            <p className="vmf-step-desc">Choose which variant (e.g. Color: Red) you want to assign images to.</p>
          </div>
          <div className="vmf-step-card">
            <span className="vmf-step-icon">🖼️</span>
            <div className="vmf-step-num-badge">Step 3</div>
            <p className="vmf-step-title">Assign &amp; save</p>
            <p className="vmf-step-desc">Click the images that belong to this variant and hit Save. Done!</p>
          </div>
        </div>

        {/* Tips */}
        <div className="vmf-tips">
          <p className="vmf-tips-title">
            <span>💡</span> Good to know
          </p>
          <div className="vmf-tip">
            <span className="vmf-tip-icon">✅</span>
            <span className="vmf-tip-text"><strong>Works automatically</strong> — the theme extension runs on any product page where you've added the block.</span>
          </div>
          <div className="vmf-tip">
            <span className="vmf-tip-icon">🏪</span>
            <span className="vmf-tip-text"><strong>Universal theme support</strong> — works with Dawn, Horizon, Craft, Sense, and virtually any Shopify theme built with standard gallery markup.</span>
          </div>
          <div className="vmf-tip">
            <span className="vmf-tip-icon">💾</span>
            <span className="vmf-tip-text"><strong>Saved as a metafield</strong> — mappings are stored directly on each product. No external database queries on the storefront.</span>
          </div>
          <div className="vmf-tip">
            <span className="vmf-tip-icon">🔄</span>
            <span className="vmf-tip-text"><strong>Re-save after adding images</strong> — if you add new images to a product, re-open and update the mapping to include them.</span>
          </div>
        </div>

        {/* Supported Themes */}
        <div className="vmf-themes">
          <p className="vmf-themes-title">
            <span>🎨</span> Supported Themes
          </p>
          <div className="vmf-themes-grid">
            {["Dawn", "Horizon", "Craft", "Sense", "Taste", "Studio", "Colorblock", "Ride", "Publisher", "Refresh", "Spotlight", "Trade", "Crave", "Origin"].map(name => (
              <span key={name} className="vmf-theme-tag">
                <span className="vmf-theme-tag-dot" />
                {name}
              </span>
            ))}
            <span className="vmf-theme-tag" style={{ background: "#e8f5e9", borderColor: "#c8e6c9" }}>
              <span className="vmf-theme-tag-dot" />
              + Any theme with standard gallery markup
            </span>
          </div>
        </div>

      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
