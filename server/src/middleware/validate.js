import { HttpError } from "./error.js";

/** Validate and replace req[source] with the parsed (and trimmed/coerced) value. */
export const validate =
  (schema, source = "body") =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
      const first = details[0];
      const message = first?.field ? `${first.field}: ${first.message}` : (first?.message ?? "Invalid input");
      return next(new HttpError(400, message, details, "invalid_input"));
    }
    req[source] = result.data;
    next();
  };
