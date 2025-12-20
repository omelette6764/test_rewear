import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "../../common/auth/jwt.strategy";
import { env } from "../../config/env";

@Module({
  imports: [
    JwtModule.register({
      secret: env().JWT_SECRET,
      signOptions: { expiresIn: env().JWT_ACCESS_TTL_SECONDS },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
