import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

// shared Zod schemas
import {
  ZAuthSignupInput,
  ZAuthLoginInput,
  ZAuthRefreshInput,
  ZAuthLogoutInput,
} from "@rewear/shared";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("signup")
  async signup(@Body(new ZodValidationPipe(ZAuthSignupInput)) body: any) {
    return await this.auth.signup(body);
  }

  @Post("login")
  async login(@Body(new ZodValidationPipe(ZAuthLoginInput)) body: any) {
    return await this.auth.login(body);
  }

  @Post("refresh")
  async refresh(@Body(new ZodValidationPipe(ZAuthRefreshInput)) body: any) {
    try {
      return await this.auth.refresh(body.refreshToken);
    } catch (e) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  @Post("logout")
  async logout(@Body(new ZodValidationPipe(ZAuthLogoutInput)) body: any) {
    return await this.auth.logout(body.refreshToken);
  }
}
