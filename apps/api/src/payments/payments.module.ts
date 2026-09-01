import { Module } from "@nestjs/common";
import { ChargesController } from "./charges.controller";
import { ChargesService } from "./charges.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [PaymentsController, ChargesController],
  providers: [PaymentsService, ChargesService]
})
export class PaymentsModule {}
