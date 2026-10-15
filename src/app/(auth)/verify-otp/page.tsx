import { redirect } from "next/navigation";

/**
 * Legacy OTP route. Signup/login/recovery now use confirmation links.
 * Keep the path public briefly so old bookmarks do not hit the auth guard oddly.
 */
export default function LegacyVerifyOtpPage() {
  redirect("/login?error=auth_confirm");
}
