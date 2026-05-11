# Cleveland Clean Car Detailing & Ceramics LLC Website

Open `index.html` in a browser to preview the site.

## Cloudflare Pages setup

This site is configured for Cloudflare Pages. It is a static site with one Pages Function for booking requests.

Cloudflare Pages project settings:

1. In Cloudflare, go to **Workers & Pages > Create application > Pages > Connect to Git**.
2. Select `87vvgvbmpq-beep/CleClean-Website`.
3. Use `main` as the production branch.
4. Use no framework preset.
5. Use `exit 0` as the build command.
6. Use `/` as the build output directory.
7. Add the environment variables listed in the booking and CMS setup sections.
8. Deploy, then connect the final custom domain under the Pages project's **Custom domains** settings.

Cloudflare Pages will redeploy when commits are pushed to the connected GitHub branch.

## Editing content in Decap CMS

Services and packages live in `content/services.json` and are editable at `/admin/` after the site is deployed. The homepage loads active services from that JSON file. If the content file cannot load, the original hardcoded service cards remain visible as a fallback.

The CMS is configured in `admin/config.yml` to edit `content/services.json`. The `/admin/` page injects the active site origin into Decap CMS at runtime and uses the Cloudflare Pages Functions at `/api/auth` and `/api/callback` for GitHub OAuth.

Create a GitHub OAuth App under GitHub **Settings > Developer settings > OAuth Apps**. Use the Cloudflare Pages site URL as the homepage URL and `https://your-domain.com/api/callback` as the authorization callback URL. Then add these Cloudflare Pages environment variables:

- `GITHUB_CLIENT_ID`: GitHub OAuth App client ID.
- `GITHUB_CLIENT_SECRET`: GitHub OAuth App client secret.

Each editor must log in with GitHub and have push access to this repository. Published CMS edits commit to the `main` branch and trigger a Cloudflare Pages redeploy.

## Booking setup

The booking form posts to the Cloudflare Pages Function at `/api/create-booking`. That function sends the admin notification and customer confirmation through Resend.

Set these Cloudflare Pages environment variables so booking request emails send correctly:

- `RESEND_API_KEY`: Resend API key.
- `BOOKING_FROM_EMAIL`: sender address, for example `Cleveland Clean <bookings@clevelandcleandetailing.com>`.
- `BOOKING_ADMIN_EMAILS`: where new requests go, for example `bookings@clevelandcleandetailing.com` or `clecleandetailing@gmail.com`.
- `BOOKING_REPLY_TO_EMAIL`: optional customer confirmation reply-to address. Defaults to `bookings@clevelandcleandetailing.com`.

The admin notification sets the customer's email as the reply-to address, so the normal email reply button starts a response to the customer.

### Gmail reply setup

To reply from `clecleandetailing@gmail.com` while sending as `bookings@clevelandcleandetailing.com`, add the bookings address in Gmail under Settings > See all settings > Accounts and Import > Send mail as > Add another email address. After verification, make `bookings@clevelandcleandetailing.com` the default sender or choose it from the From field before sending.

Before publishing, replace these deployment values:

- `sitemap.xml`: change `https://your-domain.com/` to the final website domain.
- `index.html`: add the real phone number to the call/text buttons and JSON-LD schema if you want direct phone conversion.
- `index.html`: add the final website domain as a canonical URL after the domain is connected.

SEO already included:

- Cleveland-focused page title and meta description
- Local business, service, website, and FAQ JSON-LD schema
- Search-friendly image filenames and alt text
- Explicit image dimensions for layout stability
- Before-and-after interior detailing content
- Services for interior detailing, exterior detailing, full detailing, foam wash, carpet cleaning, and gloss enhancement
- FAQ section targeting Cleveland mobile detailing searches
- Google Reviews section with three real 5-star review quotes supplied from Google review screenshots

Logo asset:

- `assets/logo-cleveland-clean-badge.png` is the selected badge logo artwork used in the site header.
