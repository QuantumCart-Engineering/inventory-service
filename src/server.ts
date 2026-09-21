import app from "./app";

import { env } from "./config/env";

const startServer = (): void => {
  app.listen(env.port, () => {
    console.log(
      `Inventory Service is running on port ${env.port}`
    );
  });
};

startServer();