import express, {
  Request,
  Response
} from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import inventoryRoutes from "./routes/inventory.routes";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

app.use(helmet());

app.use(cors());

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(morgan("dev"));

app.get(
  "/health",
  (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      service: "inventory-service",
      status: "UP"
    });
  }
);

app.use(
  "/api/v1/inventory",
  inventoryRoutes
);

app.use(errorHandler);

export default app;