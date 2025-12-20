import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { API_PREFIX, DEFAULT_CORS } from "./config/constants";
import { env } from "./config/env";

async function bootstrap() {
  const e = env();

  // rawBody:true keeps req.rawBody (Buffer) available for Stripe webhook verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.setGlobalPrefix(API_PREFIX);
  app.enableCors(DEFAULT_CORS);
  app.use(helmet());

  await app.listen(e.PORT);
  // eslint-disable-next-line no-console
  console.log(`✅ API listening on http://localhost:${e.PORT}/${API_PREFIX}`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});
