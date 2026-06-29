# Variant Media Filter V2 — Installation Guide

This guide explains how to deploy the Variant Media Filter app. This app is designed as a **Custom App** (Single Merchant), meaning you deploy it directly to a single Shopify store without going through the Shopify App Store review process.

## Prerequisites
Before you start, make sure you have:
1. A **Shopify Partners** account.
2. A free **Vercel** account (for hosting the app).
3. A free **Neon** account (for PostgreSQL database hosting).
4. **Node.js** and **npm** installed on your local computer.
5. The **Shopify CLI** installed globally (`npm install -g @shopify/cli`).

---

## Step 1: Set Up the Database (Neon)
The app uses a PostgreSQL database to store secure merchant sessions.

1. Go to [neon.tech](https://neon.tech) and create a new project.
2. Once created, go to your project dashboard and find your **Connection Strings**.
3. You will need two URLs:
   - **Pooled connection string** (usually has `-pooler` in the host).
   - **Direct connection string** (unpooled, used for running migrations).

---

## Step 2: Create the App in Shopify
1. Go to your [Shopify Partners Dashboard](https://partners.shopify.com/).
2. Navigate to **Apps** > **Create App** > **Create App Manually**.
3. Name your app (e.g., "Variant Media Filter").
4. Once created, click on **API Access** in the left sidebar.
5. Note your **Client ID** and **Client Secret**.

---

## Step 3: Deploy the Backend to Vercel
1. Upload this codebase to a new repository on GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
3. In the "Configure Project" screen, leave the Framework Preset as **Other**.
4. Open the **Environment Variables** dropdown and add the following 4 keys exactly as written:

| Variable | Value |
|----------|-------|
| `SHOPIFY_API_KEY` | *Your Shopify App Client ID* |
| `SHOPIFY_API_SECRET` | *Your Shopify App Client Secret* |
| `POSTGRES_PRISMA_URL` | *Your Neon pooled connection string* |
| `POSTGRES_URL_NON_POOLING` | *Your Neon direct connection string* |

5. Click **Deploy**.
6. Once deployed, note your Vercel project URL (e.g., `https://my-custom-filter.vercel.app`).

---

## Step 4: Finalize Configuration

Now that you have your Vercel URL, you need to sync it with your codebase and push the theme extension to Shopify.

### 1. Update the local config
Open `shopify.app.toml` in the root of the project and update the `client_id` and `application_url` fields:
```toml
client_id = "YOUR_CLIENT_ID"
application_url = "https://your-vercel-url.vercel.app"

[auth]
redirect_urls = [
  "https://your-vercel-url.vercel.app/auth/callback",
  "https://your-vercel-url.vercel.app/auth/shopify/callback"
]
```

### 2. Run Database Migration
Open your terminal in the project folder and run:
```bash
# This creates the necessary 'Session' table in your database
npx prisma migrate dev --name init
```

### 3. Deploy the Theme Extension
In your terminal, run:
```bash
shopify app deploy
```
*Note: This command will automatically upload the visual filtering script to Shopify's servers AND it will automatically update the "App URL" and "Redirect URLs" in your Shopify Partners dashboard so you don't have to type them manually!*

---

## Step 5: Install on the Store
1. Go to your Vercel URL (`https://your-vercel-url.vercel.app`).
2. You will see a login prompt. Enter the `.myshopify.com` domain of the store you want to install it on.
3. Click **Log in** and follow the prompts to install the app on the store.

### Enable the App on the Storefront
After installation:
1. Go to your Shopify Store Admin > **Online Store** > **Themes** > **Customize**.
2. Click the **App Embeds** icon (on the far left).
3. Toggle **Variant Media Filter** to ON.
4. Click **Save**.

The app is now fully functional! Open it from the Shopify Admin to start mapping images to variants.

---
---

## Advanced: Deploying to Multiple Stores (Zero App Store Fees)
Custom apps are technically restricted to a single store by Shopify. However, because this codebase dynamically pulls the API key from Vercel's environment variables, you can use **this exact same codebase and database** to host unlimited clients without paying the $19 App Store fee.

To add a second client:
1. Create a **new Custom App** in your Shopify Partners dashboard (giving you a new Client ID and Secret).
2. Create a **new Vercel project** from this same GitHub repository.
3. Add the 4 environment variables, using the **new** Client ID and Secret, but use the **exact same** Neon database strings (the database automatically isolates data by store domain).
4. Deploy the Vercel project to get a new URL.
5. In your local terminal, create a new config file linked to the new app:
   ```bash
   shopify app config link
   ```
6. Update the new `shopify.app.[client].toml` file with the new Vercel URL.
7. Push the theme extension specifically to the new app:
   ```bash
   shopify app deploy --config [client]
   ```
8. Install the app on the new store via the new Vercel URL!
