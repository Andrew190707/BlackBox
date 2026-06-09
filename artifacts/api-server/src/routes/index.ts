import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import riskRouter from "./risk";
import breakersRouter from "./breakers";
import lockdownRouter from "./lockdown";
import snapshotsRouter from "./snapshots";
import deceptionRouter from "./deception";
import incidentsRouter from "./incidents";
import simulateRouter from "./simulate";
import governanceRouter from "./governance";
import trustRouter from "./trust";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(riskRouter);
router.use(breakersRouter);
router.use(lockdownRouter);
router.use(snapshotsRouter);
router.use(deceptionRouter);
router.use(incidentsRouter);
router.use(simulateRouter);
router.use(governanceRouter);
router.use(trustRouter);

export default router;
