import nodemailer from "nodemailer";

interface AdminRegistrationInvitationData {
  fullName: string;
  email: string;
  adminCode: string;
  role: string;
  setupToken: string;
  expiresAt: Date;
}

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure =
  String(process.env.SMTP_SECURE).toLowerCase() === "true";

const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

const gradlyAppUrl =
  process.env.GRADLY_APP_URL ||
  "http://localhost:5173";

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: {
    user: smtpUser,
    pass: smtpPassword,
  },
});

export async function verifyEmailService() {
  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error(
      "SMTP configuration is incomplete. Check SMTP_HOST, SMTP_USER and SMTP_PASSWORD."
    );
  }

  await transporter.verify();

  console.log(
    "[EmailService] SMTP connection verified successfully."
  );
}

export async function sendAdminRegistrationInvitation(
  data: AdminRegistrationInvitationData
) {
  if (!smtpUser || !smtpPassword) {
    throw new Error(
      "SMTP email service is not configured."
    );
  }

  const registrationUrl =
    `${gradlyAppUrl}/admin/register?token=${encodeURIComponent(
      data.setupToken
    )}`;

  const expiresAtText =
    new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(data.expiresAt);

  const subject =
    "Gradly Admin Registration Invitation";

  const text = `
Hello ${data.fullName},

Your Gradly administrator account has been configured and is ready for registration.

Admin Code:
${data.adminCode}

Role:
${data.role}

Please use the secure registration link below to create your Admin ID and password:

${registrationUrl}

This registration link expires on:
${expiresAtText} IST

Important:
- Do not share this registration link with anyone.
- Gradly will never ask you to send your password by email.
- Your password will be securely hashed before being stored.
- If you did not expect this invitation, please contact the Gradly Super Administrator.

Regards,
Gradly Administration
`.trim();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Gradly Admin Registration</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f4f4;
  font-family:Arial,Helvetica,sans-serif;
">

<div style="
  max-width:620px;
  margin:40px auto;
  background:#ffffff;
  border:1px solid #d0d0d0;
  border-radius:8px;
  overflow:hidden;
">

  <div style="
    padding:24px;
    border-bottom:1px solid #dddddd;
  ">

    <h1 style="
      margin:0;
      font-size:28px;
      color:#111111;
    ">
      Gradly
    </h1>

    <p style="
      margin:6px 0 0;
      color:#666666;
      font-size:14px;
    ">
      Academic Intelligence & Planning Platform
    </p>

  </div>

  <div style="padding:30px 28px;">

    <h2 style="margin-top:0;color:#111111;">
      Admin Registration Invitation
    </h2>

    <p style="color:#333333;line-height:1.6;">
      Hello <strong>${escapeHtml(data.fullName)}</strong>,
    </p>

    <p style="color:#333333;line-height:1.6;">
      Your Gradly administrator account has been configured
      by the Super Administrator and is ready for registration.
    </p>

    <div style="
      margin:24px 0;
      padding:18px;
      background:#f7f7f7;
      border:1px solid #dddddd;
      border-radius:6px;
    ">

      <p style="margin:0 0 8px;">
        <strong>Admin Code:</strong>
        ${escapeHtml(data.adminCode)}
      </p>

      <p style="margin:0;">
        <strong>Role:</strong>
        ${escapeHtml(data.role)}
      </p>

    </div>

    <p style="color:#333333;line-height:1.6;">
      Click the button below to create your Admin ID and password.
    </p>

    <div style="
      text-align:center;
      margin:30px 0;
    ">

      <a
        href="${escapeHtml(registrationUrl)}"
        style="
          display:inline-block;
          padding:13px 24px;
          background:#111111;
          color:#ffffff;
          text-decoration:none;
          border-radius:5px;
          font-weight:bold;
        "
      >
        Register Admin Account
      </a>

    </div>

    <p style="
      color:#666666;
      font-size:13px;
      line-height:1.6;
    ">
      This secure registration link expires on:
      <strong>${escapeHtml(expiresAtText)} IST</strong>
    </p>

    <hr style="
      border:none;
      border-top:1px solid #eeeeee;
      margin:25px 0;
    " />

    <p style="
      color:#666666;
      font-size:13px;
      line-height:1.6;
    ">
      Security notice: Do not share this registration link with anyone.
      Gradly will never ask you to send your password by email.
    </p>

    <p style="
      color:#333333;
      line-height:1.6;
    ">
      Regards,<br />
      <strong>Gradly Administration</strong>
    </p>

  </div>
</div>

</body>
</html>
`.trim();

  const info = await transporter.sendMail({
    from: `"Gradly Administration" <${smtpUser}>`,
    to: data.email,
    subject,
    text,
    html,
  });

  console.log(
    `[EmailService] Invitation sent to ${data.email}. Message ID: ${info.messageId}`
  );

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}