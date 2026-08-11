import nodemailer, { type SendMailOptions } from "nodemailer";

type MailConfig = {
  from: string;
  host: string;
  port: number;
  secure: boolean;
};

declare global {
  var __wfhMailer: ReturnType<typeof nodemailer.createTransport> | undefined;
}

function isMailEnabled() {
  return process.env.MAIL_ENABLED === "true";
}

function getMailConfig(): MailConfig {
  const host = process.env.SMTP_HOST ?? "10.33.144.238";
  const port = Number(process.env.SMTP_PORT ?? 25);
  const from = process.env.SMTP_FROM ?? "teletrabajo@audatex.es";
  const secure = process.env.SMTP_SECURE === "true";

  if (!host || !Number.isInteger(port) || port <= 0 || !from) {
    throw new Error("SMTP_HOST, SMTP_PORT and SMTP_FROM must be valid when mail is enabled.");
  }

  return { from, host, port, secure };
}

function getTransporter() {
  if (globalThis.__wfhMailer) return globalThis.__wfhMailer;

  const config = getMailConfig();
  globalThis.__wfhMailer = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
  });

  return globalThis.__wfhMailer;
}

export async function sendMail(options: Omit<SendMailOptions, "from">) {
  if (!isMailEnabled()) return false;

  const config = getMailConfig();
  await getTransporter().sendMail({ ...options, from: config.from });
  return true;
}
