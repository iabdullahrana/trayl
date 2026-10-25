export type JourneyField =
  "from_city" | "to_city" | "travel_date" | "travel_time" | "item_type";
export type JourneyState = {
  success?: boolean;
  firstMoment?: boolean;
  notice?: string;
  journey?: Record<JourneyField, string>;
  error?: string;
  fieldErrors?: Partial<Record<JourneyField, string>>;
};

// Use the same UTC calendar day as the default Supabase database timezone.
export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

export function validateJourney(form: FormData, today = todayUTC()) {
  const read = (field: JourneyField) => {
    const value = form.get(field);
    return typeof value === "string" ? value.trim() : "";
  };
  const values = {
    from_city: read("from_city").replace(/\s+/g, " "),
    to_city: read("to_city").replace(/\s+/g, " "),
    travel_date: read("travel_date"),
    travel_time: read("travel_time"),
    item_type: read("item_type"),
  };
  const fieldErrors: NonNullable<JourneyState["fieldErrors"]> = {};
  for (const field of ["from_city", "to_city"] as const) {
    if (!values[field] || values[field].length > 100) {
      fieldErrors[field] = "Enter a city name (up to 100 characters).";
    }
  }
  if (
    values.from_city &&
    values.from_city.normalize("NFKC").toLowerCase() ===
      values.to_city.normalize("NFKC").toLowerCase()
  ) {
    fieldErrors.to_city = "Choose a different destination city.";
  }
  const parsed = new Date(`${values.travel_date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(values.travel_date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== values.travel_date
  ) {
    fieldErrors.travel_date = "Choose a valid date.";
  } else if (values.travel_date < today) {
    fieldErrors.travel_date =
      "Date can't be in the past. Choose today or a future date.";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.travel_time)) {
    fieldErrors.travel_time = "Choose a valid time.";
  }
  if (!["document", "package"].includes(values.item_type)) {
    fieldErrors.item_type = "Choose Document or Small Package.";
  }
  return { values, fieldErrors, valid: Object.keys(fieldErrors).length === 0 };
}
