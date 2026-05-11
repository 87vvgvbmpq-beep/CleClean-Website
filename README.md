# Cleveland Clean Car Detailing & Ceramics LLC Website

Open `index.html` in a browser to preview the site.

## Editing content in Decap CMS

Services and packages live in `content/services.json` and are editable at `/admin/` after the site is deployed on Netlify. The homepage loads active services from that JSON file. If the content file cannot load, the original hardcoded service cards remain visible as a fallback.

The Google Appointment Schedule availability link lives in `content/booking.json` and is editable in Decap under **Site Content > Availability Calendar**. Paste the public Google Calendar Appointment Schedule URL there after the schedule is created.

The CMS is configured in `admin/config.yml` to use Decap CMS with Netlify Identity and Git Gateway:

1. In Netlify, open the site dashboard and go to **Integrations > Identity > Netlify Identity**.
2. Enable Identity, then set registration to **Invite only** unless you intentionally want open registration.
3. Under Identity services, enable **Git Gateway** and connect it to this GitHub repository.
4. Invite editor users from the Identity panel.
5. Visit `/admin/`, log in, edit **Site Content > Services and Packages** or **Availability Calendar**, and publish.

Published CMS edits commit to the `main` branch through Git Gateway. Because the site is connected to GitHub on Netlify, each CMS commit triggers a normal Netlify redeploy.

If you prefer direct GitHub login instead, replace the `backend` block in `admin/config.yml` with:

```yml
backend:
  name: github
  repo: 87vvgvbmpq-beep/CleClean-Website
  branch: main
```

The direct GitHub backend requires each editor to log in with GitHub and have write access to the repository. Git Gateway is the recommended setup when you want to invite editors without giving them direct GitHub repository access.

## Booking setup

The booking section shows a Google Calendar Appointment Schedule for availability, then keeps the website's booking request form underneath it. Customers use the calendar to find a time that should work for both detailers, then submit the request form. The form sends the request through the Netlify Function at `/.netlify/functions/create-booking` using Resend.

Set up the schedule in Google Calendar:

1. On a computer, open Google Calendar and create or edit an **Appointment schedule**.
2. Add Brendon's partner under **Co-hosts**.
3. Under **Calendars**, turn on **Check calendars for availability**.
4. Include the co-host calendars in the availability check. Google notes that co-host availability is not checked by default, so this must be enabled explicitly.
5. Configure the Google Appointment Schedule so the public calendar only shows times that both detailers can take.
6. In Google Calendar, open the schedule's sharing options and copy either the booking page link or the inline booking page embed URL.
7. Paste the public appointment schedule URL into `content/booking.json`, or update it through `/admin/` in Decap CMS.

After this is configured, the website displays the Google availability calendar above the request form. The actual rule that both Brendon and his partner must be available is enforced by Google Appointment Schedule co-host availability checking, not by custom website code.

Set these Netlify environment variables so booking request emails send correctly:

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
