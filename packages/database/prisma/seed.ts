import { PrismaClient, LocationType, TrackingPolicy, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@moyomoyo.com").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "MoyomoyoAdmin1";
  const adminName = process.env.ADMIN_NAME ?? "Javohir";
  const passwordHash = await hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, passwordHash, role: UserRole.ADMIN, active: true },
    create: { email: adminEmail, name: adminName, passwordHash, role: UserRole.ADMIN },
  });
  console.log(`Admin user ready: ${adminEmail}`);

  const warehouse = await prisma.warehouse.upsert({
    where: { code: "SEL-01" },
    update: {
      address: "Seoul, South Korea",
      latitude: 37.5665,
      longitude: 126.978,
    },
    create: {
      code: "SEL-01",
      name: "Seoul Demo Fulfillment Center",
      address: "Seoul, South Korea",
      latitude: 37.5665,
      longitude: 126.978,
    },
  });

  const receiving = await prisma.zone.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "RCV" } },
    update: {},
    create: {
      warehouseId: warehouse.id,
      code: "RCV",
      name: "Receiving",
      sequence: 10,
    },
  });
  const storage = await prisma.zone.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "A" } },
    update: {},
    create: {
      warehouseId: warehouse.id,
      code: "A",
      name: "Storage A",
      sequence: 20,
    },
  });

  await prisma.location.upsert({
    where: { zoneId_code: { zoneId: receiving.id, code: "RCV-01" } },
    update: {},
    create: {
      zoneId: receiving.id,
      code: "RCV-01",
      barcode: "LOC-RCV-01",
      type: LocationType.RECEIVING,
    },
  });
  const storageLocations = [];
  for (const [index, code] of ["A-01-01", "A-01-02", "A-02-01"].entries()) {
    storageLocations.push(await prisma.location.upsert({
      where: { zoneId_code: { zoneId: storage.id, code } },
      update: {},
      create: {
        zoneId: storage.id,
        code,
        barcode: `LOC-${code}`,
        type: LocationType.STORAGE,
        sequence: index + 1,
      },
    }));
  }

  const sku = await prisma.sku.upsert({
    where: { code: "DEMO-001" },
    update: {},
    create: {
      code: "DEMO-001",
      name: "Demo Expiry-Tracked Product",
      trackingPolicy: TrackingPolicy.LOT,
      expiryTracked: true,
      weightKg: 0.45,
    },
  });
  await prisma.barcode.upsert({
    where: { value: "880000000001" },
    update: {},
    create: { skuId: sku.id, value: "880000000001", primary: true },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      locationId_skuId_lotNumber_status: {
        locationId: storageLocations[0].id,
        skuId: sku.id,
        lotNumber: "LOT-260701",
        status: "AVAILABLE",
      },
    },
    update: {},
    create: {
      warehouseId: warehouse.id,
      locationId: storageLocations[0].id,
      skuId: sku.id,
      lotNumber: "LOT-260701",
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      status: "AVAILABLE",
      onHandQty: 420,
      reservedQty: 62,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
