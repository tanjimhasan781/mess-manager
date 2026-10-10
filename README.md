# Mess Manager

A phone-friendly web app (PWA) for running a mess: rent, utility bills, staples, daily bazar split by meals, deposits, and a notification to every member for every cut.

## What it does

- **Manager and members.** One manager. Members join with an invite link and sign in with their mobile number and a password. The manager can hand the role to someone else.
- **Member status.** Active, deactivated (not charged for anything while deactivated, can still sign in and see history), or left (can't sign in, history kept).
- **Rent, bills, staples, other costs.** Split equally among the members the manager ticks. The manager can untick anyone or give someone a custom amount with a reason (e.g. joined mid-month).
- **Daily bazar.** Split by the meals each person ate on that day. Members mark their own meals, the manager can mark or change anyone's. If meals change, the bazar is re-split automatically.
- **Deposits.** The manager sets a monthly meal deposit and records payments (cash, bKash, Nagad...) and refunds. The app shows what each member still has to pay this month (meal deposit + rent/bills share − money brought forward − already paid).
- **Notifications.** Every cut, correction, deleted cost, deposit and meal change creates a notification showing the amount, the reason and the new balance. With phone notifications turned on, it also arrives as a push notification.
- **Ledger.** Every member can see every cut and deposit with a running balance, and anyone else's ledger too (full transparency).
- **Monthly history.** Each month shows brought forward, deposited, rent/bills, staples, meals, bazar, spent and carried forward, per member and for the whole mess. Closing a month locks it and sends everyone their summary. Leftover money carries forward automatically.
- **Activity log.** Every change, who made it and when.
- **Receipt photos** (compressed on the phone before upload).

Money is stored in paisa, and splits always add up exactly to the bill (no paisa lost to rounding).

## Run it for free (about 20 minutes)

You need: a free [Supabase](https://supabase.com) account (database) and a free [Vercel](https://vercel.com) account (hosting), plus a GitHub account.

1. **Database.** Create a Supabase project. Open *Connect* (top bar) and copy the **Transaction pooler** connection string (port 6543). Replace `[YOUR-PASSWORD]` with your database password.
2. **Create the tables.** In Supabase open *SQL Editor*, paste everything from `db/schema.sql`, and click *Run*.
   (Or on your computer: `npm install` then `DATABASE_URL="..." npm run migrate`.)
3. **Push notification keys.** On your computer run `npm install` then `npm run vapid`. It prints two lines; keep them.
   (No computer? Any online "VAPID key generator" works, or ask Claude to generate them.)
4. **Put the code on GitHub.** Create a new repository and upload this folder (without `node_modules`).
5. **Deploy.** In Vercel: *Add New → Project*, pick the repository. Under *Environment Variables* add:
   - `DATABASE_URL` = the connection string from step 1
   - `SESSION_SECRET` = any long random text (30+ characters)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` = the two lines from step 3
   - `VAPID_SUBJECT` = `mailto:your-email@example.com`

   Click *Deploy*. You get a link like `https://mess-manager-xyz.vercel.app`.
6. **Start.** Open the link on your phone, tap *Start a new mess*, then add members and send each their invite link.
7. **Install.** Android Chrome: menu → *Install app*. iPhone Safari: Share → *Add to Home Screen* (needed on iPhone for notifications, iOS 16.4+). Then open *More → Notifications → Turn on notifications*.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values (a local Postgres works)
npm run migrate
npm run dev                  # http://localhost:3000
npm test                     # cost-split unit tests
```

## Tech

Next.js 15 (App Router, server actions), PostgreSQL via `postgres`, Tailwind CSS 4, `web-push` for notifications, a hand-written service worker (`public/sw.js`). Sign-in is phone number + password with a signed cookie; no SMS costs.

Key files: `lib/split.ts` (splitting rules), `lib/ledger.ts` (costs, meals, deposits, notifications, reports), `app/actions.ts` (form handlers), `db/schema.sql`.
