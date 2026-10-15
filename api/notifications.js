// /api/notifications.js
// Serverless function (Vercel Node.js runtime). Receives Supabase Database
// Webhooks (Dashboard -> Database -> Webhooks -- see BACKEND_README.md for
// the exact tables/events to wire up).
//
// Resident alert broadcasts go out as SMS, sent through an Android phone
// running the "SMS Gateway for Android°" app (github.com/capcom6/android-sms-gateway)
// in Cloud Server mode -- the phone is the actual sender, this function just
// POSTs to the gateway's cloud relay, which pushes the send down to the phone.
// Admin and reporter notifications still go out as email via Nodemailer/SMTP,
// since those go to a handful of known people rather than the whole town.
//
// Handles three triggers, dispatched by table + event:
//   1. INSERT on alerts     -> SMS every resident with a phone number on file
//   2. INSERT on incidents  -> email every admin
//   3. UPDATE on incidents  -> email the reporter, only when status changed
//
// Required Vercel environment variables:
//   SMS_GATEWAY_LOGIN          - username shown in the SMS Gateway app's
//                                Cloud Server section on the phone
//   SMS_GATEWAY_PASSWORD       - password shown alongside it
//   SMS_GATEWAY_URL             - optional override; defaults to
//                                https://api.sms-gate.app/3rdparty/v1/message
//                                (only change this if you're self-hosting a
//                                private server instead of using the public
//                                cloud relay)
//   SMTP_HOST                  - e.g. "smtp.gmail.com"
//   SMTP_PORT                  - e.g. 465 (SSL) or 587 (STARTTLS)
//   SMTP_SECURE                - "true" for port 465, "false" for 587
//   SMTP_USER                  - the mailbox address, e.g. rainalerts@gmail.com
//   SMTP_PASS                  - a 16-character Gmail App Password (NOT your
//                                normal account password -- generate one at
//                                myaccount.google.com/apppasswords, requires
//                                2-Step Verification to be turned on first)
//   EMAIL_FROM                 - e.g. "RAIN Alerts <rainalerts@gmail.com>" --
//                                must use the same address as SMTP_USER or
//                                Gmail will reject/rewrite it
//   SUPABASE_URL                - same project URL as assets/js/supabase-client.js
//   SUPABASE_SERVICE_ROLE_KEY   - Supabase -> Settings -> API -> service_role.
//                                 NEVER put this in frontend code -- it bypasses
//                                 every RLS policy. It's only safe here because
//                                 this file only ever runs on the server.
//   EMAIL_WEBHOOK_SECRET        - any random string you make up. Set the same
//                                 value as a custom header on the Supabase
//                                 webhook so this endpoint can reject requests
//                                 that don't come from Supabase.
//   APP_URL                     - e.g. "https://your-app.vercel.app", used to
//                                 build links inside the emails

import nodemailer from 'nodemailer';

let transporter; // reused across warm invocations instead of reconnecting every call

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: process.env.SMTP_SECURE !== 'false', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (req.headers['x-webhook-secret'] !== process.env.EMAIL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, table, record, old_record } = req.body || {};

  try {
    if (table === 'alerts' && type === 'INSERT') {
      await notifyResidentsOfAlert(record);
    } else if (table === 'incidents' && type === 'INSERT') {
      await notifyAdminsOfIncident(record);
    } else if (table === 'incidents' && type === 'UPDATE' && old_record && record.status !== old_record.status) {
      await notifyReporterOfStatusChange(record);
    }
    // Anything else that matches no branch above is a no-op, not an error --
    // e.g. an incident UPDATE that didn't touch status.
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('notifications.js error:', err);
    return res.status(500).json({ error: 'Failed to process notification' });
  }
}

// ---------------------------------------------------------------------
// Supabase REST helper (service role key -- bypasses RLS, server-only)
// ---------------------------------------------------------------------
async function supabaseSelect(pathAndQuery) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    console.error('Supabase REST error:', await res.text());
    return [];
  }
  return res.json();
}

// ---------------------------------------------------------------------
// Nodemailer helpers
// ---------------------------------------------------------------------
async function sendEmail({ to, subject, html }) {
  try {
    await getTransporter().sendMail({ from: process.env.EMAIL_FROM, to, subject, html });
  } catch (err) {
    console.error('SMTP send error:', err.message);
  }
}

async function sendEmailBatch(emails) {
  // Nodemailer/SMTP has no native batch endpoint like Resend did, so send
  // each message individually. At resident-list scale (tens to low hundreds)
  // this is well within Gmail's ~500/day sending limit. Sent one at a time
  // (not Promise.all) so a slow/failed send can't spike memory or trip
  // Gmail's rate limiting from a burst of simultaneous connections.
  for (const email of emails) {
    await sendEmail(email);
  }
}

// ---------------------------------------------------------------------
// SMS Gateway for Android° helpers (Cloud Server mode)
// Docs: https://docs.sms-gate.app/  --  the phone itself is the sender;
// this just calls the cloud relay, which pushes the send down to the phone.
// ---------------------------------------------------------------------
const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || 'https://api.sms-gate.app/3rdparty/v1/message';
const SMS_BATCH_SIZE = 50; // keep each request modest rather than sending hundreds of numbers at once

function getSmsAuthHeader() {
  const creds = `${process.env.SMS_GATEWAY_LOGIN}:${process.env.SMS_GATEWAY_PASSWORD}`;
  return 'Basic ' + Buffer.from(creds).toString('base64');
}

// Sends one message to many numbers in a single gateway request (true
// one-to-many -- the gateway/phone handles fanning it out), chunked so a
// single request never carries an unreasonable number of recipients.
async function sendSmsBroadcast(phoneNumbers, text) {
  if (!phoneNumbers.length) return;
  if (!process.env.SMS_GATEWAY_LOGIN || !process.env.SMS_GATEWAY_PASSWORD) {
    console.error('SMS not sent: SMS_GATEWAY_LOGIN/SMS_GATEWAY_PASSWORD are not set.');
    return;
  }

  for (let i = 0; i < phoneNumbers.length; i += SMS_BATCH_SIZE) {
    const chunk = phoneNumbers.slice(i, i + SMS_BATCH_SIZE);
    try {
      const res = await fetch(SMS_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: getSmsAuthHeader(),
        },
        body: JSON.stringify({
          textMessage: { text },
          phoneNumbers: chunk,
          withDeliveryReport: false, // set true if you later add a webhook to track delivery status
        }),
      });
      if (!res.ok) {
        console.error('SMS gateway error:', res.status, await res.text());
      }
    } catch (err) {
      console.error('SMS send error:', err.message);
    }
  }
}

// ---------------------------------------------------------------------
// 1. Alert broadcasts
// ---------------------------------------------------------------------
async function notifyResidentsOfAlert(alert) {
  const rows = await supabaseSelect('profiles?select=phone&phone=not.is.null');
  const phoneNumbers = [...new Set(rows.map((r) => r.phone).filter(Boolean))];
  if (!phoneNumbers.length) return;

  const severityLabel = (alert.severity || '').toUpperCase();
  // Plain text, not HTML -- this is SMS. Kept short since carriers split
  // anything over 160 chars into multiple message segments.
  const text = [
    `RAIN Alert (${severityLabel}): ${alert.title || 'New alert issued'}`,
    alert.area ? `Area: ${alert.area}` : null,
    alert.message || null,
    'Open the RAIN app for full details.',
  ].filter(Boolean).join('\n');

  await sendSmsBroadcast(phoneNumbers, text);
}

// ---------------------------------------------------------------------
// 2. New incident report -> admins
// ---------------------------------------------------------------------
async function notifyAdminsOfIncident(incident) {
  const rows = await supabaseSelect('profiles?select=email&role=eq.admin&email=not.is.null');
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))];
  if (!emails.length) return;

  const html = `
    <p>A new incident report was just submitted.</p>
    <p><strong>${escapeHtml(incident.category || 'Incident')}</strong> — ${escapeHtml(incident.area || 'Location not provided')}</p>
    <p>${escapeHtml(incident.description || 'No description provided.')}</p>
    <p><a href="${process.env.APP_URL || ''}/admin-incidents.html">Review it in the admin dashboard</a></p>`;

  await sendEmailBatch(
    emails.map((email) => ({
      to: email,
      subject: `New incident report: ${incident.category || 'Incident'}`,
      html,
    }))
  );
}

// ---------------------------------------------------------------------
// 3. Incident status change -> the reporter
// ---------------------------------------------------------------------
async function notifyReporterOfStatusChange(incident) {
  if (!incident.reporter_id) return; // reports without a signed-in reporter can't be notified
  const rows = await supabaseSelect(`profiles?select=email,full_name&id=eq.${incident.reporter_id}`);
  const reporter = rows[0];
  if (!reporter || !reporter.email) return;

  const statusLabel = { pending: 'Pending', verified: 'Reviewed', resolved: 'Resolved', dismissed: 'Dismissed' }[incident.status] || incident.status;
  const html = `
    <p>Hi ${escapeHtml(reporter.full_name || 'there')},</p>
    <p>Your incident report (<strong>${escapeHtml(incident.category || 'Incident')}</strong>) has been updated to:</p>
    <p style="font-size:1.1em;"><strong>${escapeHtml(statusLabel)}</strong></p>
    <p style="color:#666; font-size:.85em;">Thank you for helping keep your community informed.</p>`;

  await sendEmail({
    to: reporter.email,
    subject: `Update on your incident report: ${statusLabel}`,
    html,
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
