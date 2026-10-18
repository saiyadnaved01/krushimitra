import { Router } from "express";
import multer from "multer";
import { HttpError } from "../middleware/error.js";
import { assess, looksLikeImage } from "../services/disease.js";

const router = Router();

// Images are held in memory only long enough to validate them, then discarded.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)
      ? cb(null, true)
      : cb(new HttpError(400, "Please upload a JPG, PNG, or WebP image.", undefined, "invalid_image")),
});

router.post("/analyze", upload.single("image"), (req, res) => {
  if (!req.file) throw new HttpError(400, "Attach a crop image in the 'image' field.", undefined, "invalid_image");
  if (!looksLikeImage(req.file.buffer)) {
    throw new HttpError(400, "That file doesn't look like a valid JPG, PNG, or WebP image.", undefined, "invalid_image");
  }
  res.json(assess());
});

export default router;
