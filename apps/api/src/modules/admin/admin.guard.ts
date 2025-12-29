import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers["x-admin-key"];
    const expected = process.env.ADMIN_KEY;
    if (!expected) return true; // MVP: allow if no key configured
    if (key !== expected) throw new UnauthorizedException("Invalid admin key");
    return true;
  }
}
