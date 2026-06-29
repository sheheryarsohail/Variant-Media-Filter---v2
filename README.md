# Variant Media Filter V2 — Installation Guide

This guide explains how to deploy the Variant Media Filter app. This app is designed as a **Custom App**, meaning you deploy it directly to a single Shopify store via a custom installation link.

## Prerequisites
Before you start, make sure you have:
1. A **Shopify Partners** account.
2. A free **Vercel** account (for hosting the app & database).
3. **Node.js** and **npm** installed on your local computer.
4. The **Shopify CLI** installed globally (`npm install -g @shopify/cli`).

---

## Step 1: Create the App in Shopify
1. Go to your [Shopify Partners Dashboard](https://partners.shopify.com/).
2. Navigate to **Apps** > **Create App** > **Create App Manually**.
3. Name your app (e.g., "Variant Media Filter").
4. Once created, click on **API Access** in the left sidebar.
5. Note your **Client ID** and **Client Secret**.

---

## Step 2: Deploy to Vercel & Create Database
1. Upload this codebase to a new repository on GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
3. In the "Configure Project" screen, leave the Framework Preset as **Other**.
4. Open the **Environment Variables** dropdown and add the following 2 keys:
   - `SHOPIFY_API_KEY` (Your Shopify App Client ID)
   - `SHOPIFY_API_SECRET` (Your Shopify App Client Secret)
5. Click **Deploy**.
6. Once deployment finishes, go to the project dashboard in Vercel.
7. Click the **Storage** tab at the top.
8. Click **Create Database** and select **Postgres** (Neon).
9. Follow the prompts to create it. Vercel will automatically inject the `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING` environment variables into your project!
10. Note your Vercel project URL (e.g., `https://my-custom-filter.vercel.app`).

---

## Step 3: Finalize Configuration

Now that you have your Vercel URL and Database, you need to sync it with your local codebase and push the theme extension to Shopify.

### 1. Update the local config
Open `shopify.app.toml` in the root of the project on your computer and update the `client_id` and `application_url` fields:
```toml
client_id = "YOUR_CLIENT_ID"
application_url = "https://your-vercel-url.vercel.app"

[auth]
redirect_urls = [
  "https://your-vercel-url.vercel.app/auth/callback",
  "https://your-vercel-url.vercel.app/auth/shopify/callback"
]
```

### 2. Pull Vercel Environment Variables
In your terminal, link your local folder to Vercel so you can pull the database URLs:
```bash
# Install Vercel CLI if you don't have it
npm i -g vercel

# Link to your Vercel project and pull the environment variables
vercel link
vercel env pull .env
```

### 3. Run Database Migration
Now that your `.env` file has the database URLs, run:
```bash
# This creates the necessary 'Session' table in your database
npx prisma migrate dev --name init
```

### 4. Deploy the Theme Extension
In your terminal, run:
```bash
shopify app deploy
```
*Note: This command will automatically upload the visual filtering script to Shopify's servers AND it will automatically update the "App URL" and "Redirect URLs" in your Shopify Partners dashboard so you don't have to type them manually!*

---

## Step 4: Generate the Install Link & Install
Since this is a custom app, you will install it by generating a custom installation link.

1. Go back to your [Shopify Partners Dashboard](https://partners.shopify.com/) and click on your app.
2. Click **Distribution** in the left sidebar.
3. Click **Custom Distribution**.
4. Enter the **.myshopify.com url** of the store you want to install it on.
5. Click **Generate link**.
6. Copy the installation link, open it in a new tab, and follow the prompts to install the app on the store.

### Enable the App on the Storefront
After installation is complete:
1. Go to your Shopify Store Admin > **Online Store** > **Themes** > **Customize**.
2. Click the **App Embeds** icon (on the far left).
3. Toggle **Variant Media Filter** to ON.
4. Click **Save**.

The app is now fully functional! Open it from the Shopify Admin to start mapping images to variants.
