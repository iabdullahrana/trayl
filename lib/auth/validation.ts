export type AuthField =
  "name" | "email" | "password" | "phone" | "is_adult_confirmed";
export type AuthState = {
  error?: string;
  success?: string;
  fieldErrors?: Partial<Record<AuthField, string>>;
};

export function validateAuth(form: FormData, mode: "login" | "signup") {
  const read = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  const values = {
    name: read("name").trim(),
    email: read("email").trim().toLowerCase(),
    password: read("password"),
    phone: read("phone").trim(),
    is_adult_confirmed: read("is_adult_confirmed") === "on",
  };
  const fieldErrors: NonNullable<AuthState["fieldErrors"]> = {};
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) ||
    values.email.length > 254
  ) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (!values.password || values.password.length > 128) {
    fieldErrors.password = "Enter a password of up to 128 characters.";
  }
  if (mode === "signup") {
    if (!values.name || values.name.length > 100) {
      fieldErrors.name = "Enter your name (up to 100 characters).";
    }
    if (values.password.length < 8) {
      fieldErrors.password = "Use at least 8 characters for your password.";
    }
    if (
      values.phone &&
      (!/^[+\d\s().-]+$/.test(values.phone) ||
        values.phone.length > 30 ||
        values.phone.replace(/\D/g, "").length < 7)
    ) {
      fieldErrors.phone = "Enter a valid phone number, or leave it blank.";
    }
    if (!values.is_adult_confirmed) {
      fieldErrors.is_adult_confirmed =
        "You must confirm that you are 18 years or older.";
    }
  }
  return { values, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}

export function authErrorMessage(code?: string) {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "This email is already registered. Please log in.";
    case "invalid_credentials":
      return "The email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email before logging in. Check your inbox for the confirmation email.";
    case "weak_password":
      return "Choose a stronger password that meets the account password requirements.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "signup_disabled":
      return "New account registration is currently unavailable.";
    default:
      return "We couldn't complete your request. Please try again shortly.";
  }
}
