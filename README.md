# Cleveland Clean Car Detailing & Ceramics LLC Website

Open `index.html` in a browser to preview the site.

## Booking automation

The booking form posts to Netlify Functions and uses Netlify Blobs to store appointment requests. It sends:

- an immediate booking request email to admins
- an immediate request follow-up to the customer
- customer confirmation/cancellation emails from admin email links
- hourly admin reminders for upcoming bookings
- a post-service customer review follow-up after confirmed appointments

Deploy on Netlify and set these environment variables:

- `RESEND_API_KEY`: Resend API key used for transactional email.
- `BOOKING_FROM_EMAIL`: verified sender, such as `Cleveland Clean <bookings@your-domain.com>`.
- `BOOKING_ADMIN_EMAILS`: comma-separated admin inboxes. Defaults to `clecleandetailing@gmail.com`.
- `BOOKING_REPLY_TO_EMAIL`: optional reply-to address for customer emails.
- `SITE_URL`: production website URL used for admin confirm/cancel links.
- `BOOKING_TIME_ZONE`: optional; defaults to `America/New_York`.
- `BOOKING_ADMIN_REMINDER_HOURS`: optional comma-separated reminder windows. Defaults to `24,2`.
- `BOOKING_CUSTOMER_FOLLOWUP_HOURS`: optional post-appointment follow-up delay. Defaults to `24`.
- `BOOKING_REVIEW_URL`: optional Google review URL. Defaults to the existing Google Maps link.

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
