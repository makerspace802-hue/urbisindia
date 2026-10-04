import { Email } from "@convex-dev/auth/providers/Email";
import { ConvexError } from "convex/values";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest({ identifier: email, token }) {
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: process.env.VLY_APP_NAME || "a freebuff.com application",
        },
        {
          headers: {
            "x-api-key": "fb_email_2crN1hqIArZP2bEfvjp5Qik4",
          },
        },
      );
    } catch (error) {
      // Two things used to go wrong here, and together they turned any email
      // hiccup into the opaque "[CONVEX A(auth.signIn)] … Server Error" the
      // sign-in screen was showing.
      //
      // 1. `JSON.stringify(error)` cannot serialise an Axios error — its
      //    `request` and `config` are circular — so this line threw a
      //    TypeError of its own and the original cause was lost before the
      //    first one was ever reported.
      // 2. Whichever error escaped was a plain `Error`, whose message Convex
      //    replaces with a request-id wrapper. Nothing readable crossed the
      //    wire.
      //
      // Log the parts that matter (they land in the deployment logs, where
      // the old code logged nothing at all) and raise a `ConvexError`, which
      // is the one type Convex forwards to the browser intact.
      const detail = axios.isAxiosError(error)
        ? {
            to: email,
            status: error.response?.status,
            body:
              typeof error.response?.data === "string"
                ? error.response.data.slice(0, 300)
                : undefined,
            message: error.message,
          }
        : { to: email, message: String(error) };
      console.error("[email-otp] could not send the verification code", detail);
      throw new ConvexError({
        code: "otp_email_failed",
        message: `Could not email a code to ${email}. Try again in a moment.`,
      });
    }
  },
});
