# Cleveland Clean Car Detailing & Ceramics LLC Website

Open `index.html` in a browser to preview the site.

## Booking automation

The booking form posts to Netlify Functions and uses Netlify Blobs to store appointment requests. It sends:

- available appointment times from the Google Calendar named `Detailing`
- immediate confirmed-booking emails to admins and the customer
- customer confirmation/cancellation emails from admin email links
- hourly admin reminders for upcoming bookings
- a post-service customer review follow-up after confirmed appointments

Create availability in Google Calendar by adding timed events on the `Detailing` calendar with titles that start with `Available.`. When a customer books a slot, the function changes that event title to `Booked - [customer name]` by default.

Deploy on Netlify and set these environment variables:

- `RESEND_API_KEY`: Resend API key used for transactional email.
- `BOOKING_FROM_EMAIL`: verified sender, such as `Cleveland Clean <bookings@clevelandcleandetailing.com>`.
- `BOOKING_ADMIN_EMAILS`: comma-separated admin inboxes. Set to `bookings@clevelandcleandetailing.com`.
- `BOOKING_REPLY_TO_EMAIL`: inbox for customer replies. Set to `bookings@clevelandcleandetailing.com`.
- `SITE_URL`: production website URL used for admin confirm/cancel links.
- `BOOKING_TIME_ZONE`: optional; defaults to `America/New_York`.
- `BOOKING_ADMIN_REMINDER_HOURS`: optional comma-separated reminder windows. Defaults to `24,2`.
- `BOOKING_CUSTOMER_FOLLOWUP_HOURS`: optional post-appointment follow-up delay. Defaults to `24`.
- `BOOKING_REVIEW_URL`: optional Google review URL. Defaults to the existing Google Maps link.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google service account client email.
- `GOOGLE_PRIVATE_KEY`: Google service account private key. Keep the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines; Netlify can store newlines or escaped `\n` line breaks.
- `GOOGLE_CALENDAR_NAME`: optional Google Calendar name. Defaults to `Detailing`.
- `GOOGLE_CALENDAR_ID`: optional calendar ID override if the service account cannot find the calendar by name.
- `GOOGLE_AVAILABLE_EVENT_PREFIX`: optional title prefix for open slots. Defaults to `Available.`.
- `GOOGLE_BOOKING_LOOKAHEAD_DAYS`: optional number of days to show availability. Defaults to `30`.
- `GOOGLE_BOOKING_EVENT_ACTION`: optional; use `update` to rename the availability event or `delete` to remove it after booking. Defaults to `update`.

Share the `Detailing` Google Calendar with the service account email and grant permission to make changes to events.

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
