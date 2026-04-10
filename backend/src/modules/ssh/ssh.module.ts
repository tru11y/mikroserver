import { Module } from "@nestjs/common";
import { SshGateway } from "./ssh.gateway";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [AuthModule, PrismaModule],
  providers: [SshGateway],
})
export class SshModule {}
