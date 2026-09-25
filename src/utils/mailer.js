/**
 * Mailer Utility
 * 
 * Architectural Intent:
 * Abstract wrapper for `nodemailer` that supports graceful degradation.
 * If SMTP credentials are not provided (e.g., local development), it fails over 
 * to logging the links to the console, allowing developers to test auth flows 
 * without needing an active Mailgun/SendGrid account.
 * 
 * Note:
 * Throws errors in `isProduction` mode if SMTP is missing, serving as a fail-safe.
 */
import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })
  : null;

export async function sendVerificationEmail(email, token) {
  if (!transporter) {
    if (config.isProduction) throw new Error("SMTP is not configured");
    console.log(`[DEV MODE] Verification Email sent to ${email}. Link: ${config.frontendOrigin}/verify-email/${token}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify your Nirbhor email",
    text: `Verify your email at ${config.frontendOrigin}/verify-email/${token}`,
  });
}

export async function sendPasswordResetEmail(email, token) {
  if (!transporter) {
    if (config.isProduction) throw new Error("SMTP is not configured");
    console.log(`[DEV MODE] Password Reset Email sent to ${email}. Link: ${config.frontendOrigin}/reset-password/${token}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset your Nirbhor password",
    text: `Reset your password at ${config.frontendOrigin}/reset-password/${token}`,
  });
}
