import { Module } from "@nestjs/common";
import { IntakeController } from "./intake.controller";
import { IntakeService } from "./intake.service";
import { DatabaseService } from "../../services/database.service";

@Module({
  controllers: [IntakeController],
  providers: [IntakeService, DatabaseService],
})
export class IntakeModule {}
