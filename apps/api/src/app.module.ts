import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CatalogModule } from "./catalog/catalog.module";
import { DeliveriesModule } from "./deliveries/deliveries.module";
import { HealthModule } from "./health/health.module";
import { InboundModule } from "./inbound/inbound.module";
import { InventoryModule } from "./inventory/inventory.module";
import { OutboundModule } from "./outbound/outbound.module";
import { TasksModule } from "./tasks/tasks.module";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { WarehouseModule } from "./warehouse/warehouse.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
    WarehouseModule,
    CatalogModule,
    InboundModule,
    InventoryModule,
    OutboundModule,
    DeliveriesModule,
    TasksModule,
  ],
})
export class AppModule {}
