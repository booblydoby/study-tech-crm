import { Module } from "@nestjs/common";
import { AttendanceModule } from "../attendance/attendance.module";
import { LessonsController } from "./lessons.controller";
import { LessonsService } from "./lessons.service";

@Module({
  imports: [AttendanceModule],
  controllers: [LessonsController],
  providers: [LessonsService]
})
export class LessonsModule {}
