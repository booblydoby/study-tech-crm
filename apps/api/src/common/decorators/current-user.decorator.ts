import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type AuthUser = {
  sub: string;
  email: string;
  fullName: string;
  role: string;
  teacherId?: string;
  studentId?: string;
};

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
});
