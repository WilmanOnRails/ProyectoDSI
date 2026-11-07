-- Datos adicionales del cliente para el encabezado del presupuesto
ALTER TABLE "proyectos"
  ADD COLUMN "telefono_cliente" TEXT,
  ADD COLUMN "correo_cliente" TEXT,
  ADD COLUMN "direccion_cliente" TEXT;

-- Datos comerciales y cierre financiero del presupuesto
ALTER TABLE "presupuestos"
  ADD COLUMN "numero" TEXT,
  ADD COLUMN "fecha_vigencia" TIMESTAMP(3),
  ADD COLUMN "pct_imprevistos" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "imprevistos" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "subtotal_neto" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "anticipo_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "forma_pago" TEXT,
  ADD COLUMN "tiempo_ejecucion" TEXT,
  ADD COLUMN "exclusiones" TEXT,
  ADD COLUMN "garantias" TEXT,
  ADD COLUMN "responsable_tecnico" TEXT,
  ADD COLUMN "observaciones" TEXT;

CREATE UNIQUE INDEX "presupuestos_numero_key" ON "presupuestos"("numero");

-- Capítulos y orden de presentación de las actividades
ALTER TABLE "actividades"
  ADD COLUMN "capitulo_codigo" TEXT,
  ADD COLUMN "capitulo_nombre" TEXT,
  ADD COLUMN "orden" INTEGER;

-- Datos del emisor
ALTER TABLE "configuracion"
  ADD COLUMN "telefono" TEXT,
  ADD COLUMN "direccion" TEXT,
  ADD COLUMN "correo" TEXT;

-- Categoría de subcontratos y orden dentro del presupuesto
ALTER TABLE "presupuesto_items"
  ADD COLUMN "costo_subcontrato_cong" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "orden" INTEGER;
