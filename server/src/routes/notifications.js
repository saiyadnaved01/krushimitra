import { Router } from "express";
import { HttpError } from "../middleware/error.js";

const router = Router();

router.get("/", (req, res) => {
  const items = req.app.locals.db.notifications.forUser(req.user.id);
  res.json({ notifications: items, unread: items.filter((n) => !n.read).length });
});

// Declared before "/:id/read" so "read-all" is never treated as an id.
router.post("/read-all", (req, res) => {
  req.app.locals.db.notifications.markAllRead(req.user.id);
  res.json({ ok: true });
});

router.patch("/:id/read", (req, res) => {
  const n = req.app.locals.db.notifications.markRead(req.user.id, Number(req.params.id));
  if (!n) throw new HttpError(404, "Notification not found.", undefined, "not_found");
  res.json({ notification: n });
});

export default router;
