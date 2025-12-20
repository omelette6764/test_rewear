import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type RequestUser = {
  userId: string;
  email: string;
};

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as RequestUser;
});

export const CurrentUserId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  const user = req.user as RequestUser | undefined;
  if (!user?.userId) return "";
  return user.userId;
});
