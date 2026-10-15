"use server";

import { revalidatePath } from "next/cache";
import { getAuthErrorMessage } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/server";

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (fullName.length > 120) {
    return {
      status: "error",
      message: "Name must be 120 characters or fewer.",
    };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return {
      status: "error",
      message: "You must be signed in to update your profile.",
    };
  }

  const userId = claimsData.claims.sub;

  // Upsert covers the rare case where the signup trigger did not create a row.
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      full_name: fullName.length > 0 ? fullName : null,
    },
    { onConflict: "id" },
  );

  if (error) {
    return {
      status: "error",
      message: getAuthErrorMessage(error),
    };
  }

  revalidatePath("/profile");
  return {
    status: "success",
    message: "Profile updated.",
  };
}
