import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import riskRouter from "./risk";
import breakersRouter from "./breakers";
import lockdownRouter from "./lockdown";
import snapshotsRouter from "./snapshots";
import deceptionRouter from "./deception";
import incidentsRouter from "./incidents";
import usersRouter from "./users";
import simulateRouter from "./simulate";
import governanceRouter from "./governance";
import trustRouter from "./trust";
import narrativeRouter from "./narrative";
import identityRouter from "./identity";
import fileAccessRouter from "./fileAccess";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(riskRouter);
router.use(breakersRouter);
router.use(lockdownRouter);
router.use(snapshotsRouter);
router.use(deceptionRouter);
router.use(incidentsRouter);
router.use(usersRouter);
router.use(simulateRouter);
router.use(governanceRouter);
router.use(trustRouter);
router.use(narrativeRouter);
router.use(identityRouter);
router.use(fileAccessRouter);

export default router;
