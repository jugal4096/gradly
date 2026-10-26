import nodemailer from "nodemailer";

const recipient = "jugalpkhr@gmail.com";
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpSecure = String(process.env.SMTP_SECURE).toLowerCase() === "true";
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: { user: smtpUser, pass: smtpPassword },
});

export interface InstitutionRequest {
  collegeName: string;
  locality: string;
  guestId?: string;
}

export async function sendInstitutionRequest(data: InstitutionRequest) {
  if (!smtpHost || !smtpUser || !smtpPassword) {
    throw new Error("Institution request email is not configured. Please contact the administrator directly.");
  }

  const collegeName = data.collegeName.trim();
  const locality = data.locality.trim();
  const guestId = data.guestId?.trim() || "Not provided";
  const submittedAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  const subject = `Gradly institution request: ${collegeName}`;
  const text = [
    "GRADLY — INSTITUTION ADDITION REQUEST",
    "",
    "Hello Jugal,",
    "",
    "A guest user has requested that an institution be added to Gradly.",
    "",
    "College / Institution Name: " + collegeName,
    "Locality / City: " + locality,
    "Guest ID: " + guestId,
    "Submitted at: " + submittedAt + " IST",
    "",
    "REQUEST",
    "Please review this institution and add it to the available institution list if appropriate.",
    "",
    "Regards,",
    "Gradly Institution Request Form",
  ].join("\n");

  const info = await transporter.sendMail({
    from: `"Gradly Institution Requests" <${smtpUser}>`,
    to: recipient,
    replyTo: smtpUser,
    subject,
    text,
  });

  console.log(`[GuestInstitutionRequest] Request email sent. Message ID: ${info.messageId}`);
  return { messageId: info.messageId };
}
