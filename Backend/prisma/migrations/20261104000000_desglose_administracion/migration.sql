-- AlterTable
ALTER TABLE "presupuestos"
  ADD COLUMN "pct_administracion" DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  ADD COLUMN "administracion" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "presupuestos" ALTER COLUMN "pct_indirectos" SET DEFAULT 5.00;

-- AlterTable
ALTER TABLE "configuracion"
  ADD COLUMN "pct_administracion_def" DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  ADD COLUMN "pct_imprevistos_def" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "configuracion" ALTER COLUMN "pct_indirectos_def" SET DEFAULT 5.00;
