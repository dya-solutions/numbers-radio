"use server";

import { getSupabaseAdmin, type SubmissionType } from "@/lib/supabaseServer";

export interface SubmitResult {
  ok: boolean;
  message: string;
}

const MAX_MESSAGE = 4000;

export async function submitEntry(
  type: SubmissionType,
  _prev: SubmitResult | null,
  formData: FormData,
): Promise<SubmitResult> {
  // Honeypot field - real people leave this empty; bots often fill it.
  if ((formData.get("company") as string)?.trim()) {
    return { ok: true, message: "Thank you. Your message has been received." };
  }

  const name = ((formData.get("name") as string) ?? "").trim();
  const email = ((formData.get("email") as string) ?? "").trim();
  const message = ((formData.get("message") as string) ?? "").trim();

  if (!message) {
    return { ok: false, message: "Please write a message before sending." };
  }
  if (message.length > MAX_MESSAGE) {
    return { ok: false, message: "That message is a little too long. Please shorten it." };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("submissions").insert({
      type,
      name: name || null,
      email: email || null,
      message,
    });

    if (error) {
      console.error("Supabase insert failed:", error.message);
      return {
        ok: false,
        message: "Sorry, something went wrong saving your message. Please try again later.",
      };
    }

    return {
      ok: true,
      message:
        type === "prayer"
          ? "Your prayer request has been received. Our team will be praying with you."
          : "Thank you for your feedback. We read every message.",
    };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      message: "Sorry, the message could not be sent right now. Please try again later.",
    };
  }
}

export async function submitFeedback(prev: SubmitResult | null, formData: FormData) {
  return submitEntry("feedback", prev, formData);
}

export async function submitPrayer(prev: SubmitResult | null, formData: FormData) {
  return submitEntry("prayer", prev, formData);
}
