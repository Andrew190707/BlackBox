import { Router } from "express";
import { identityResetStatus } from "../engines/identityResetStatus";

const router = Router();

router.get("/identity/status", (req, res) => {
  res.json(identityResetStatus.snapshot());
});

export default router;
