export class HttpError extends Error {
  /** `code` is a stable, language-neutral identifier the client translates. */
  constructor(status, message, details, code) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

/** Wrap async route handlers so rejected promises reach the error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFound(_req, _res, next) {
  next(new HttpError(404, "Route not found", undefined, "not_found"));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err.name === "MulterError") {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(400).json({
      error: {
        code: tooBig ? "image_too_large" : "invalid_upload",
        message: tooBig ? "Image must be smaller than 10 MB." : "Invalid file upload.",
      },
    });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "invalid_input", message: "Invalid JSON body" } });
  }
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: {
      code: status >= 500 ? "server_error" : (err.code ?? (status === 404 ? "not_found" : undefined)),
      message: status >= 500 ? "Something went wrong on our end." : err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  });
}
