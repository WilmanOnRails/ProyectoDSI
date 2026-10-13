-- CreateEnum
CREATE TYPE "tipo_recurso" AS ENUM ('material', 'mano_obra', 'equipo', 'transporte');

-- CreateEnum
CREATE TYPE "rol" AS ENUM ('administrador', 'presupuestista', 'solo_lectura');

-- CreateTable
CREATE TABLE "recursos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "tipo_recurso" NOT NULL,
    "categoria" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "costo_unitario" DECIMAL(12,2) NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'Manual',
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recursos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_precios" (
    "id" TEXT NOT NULL,
    "recurso_id" TEXT NOT NULL,
    "precio" DECIMAL(12,2) NOT NULL,
    "fuente" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrado_por" TEXT,

    CONSTRAINT "historial_precios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actividades" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,

    CONSTRAINT "actividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apu_detalle" (
    "id" TEXT NOT NULL,
    "actividad_id" TEXT NOT NULL,
    "recurso_id" TEXT NOT NULL,
    "cantidad_por_unidad" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "apu_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apu_costo_cache" (
    "actividad_id" TEXT NOT NULL,
    "costo_materiales" DECIMAL(12,2) NOT NULL,
    "costo_mano_obra" DECIMAL(12,2) NOT NULL,
    "costo_equipo" DECIMAL(12,2) NOT NULL,
    "costo_transporte" DECIMAL(12,2) NOT NULL,
    "costo_total" DECIMAL(12,2) NOT NULL,
    "fecha_calculo" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apu_costo_cache_pkey" PRIMARY KEY ("actividad_id")
);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cliente" TEXT,
    "ubicacion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'En elaboración',
    "valor_estimado" DECIMAL(14,2),

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuestos" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "nombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pct_indirectos" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "pct_utilidad" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "pct_impuestos" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "costos_directos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costo_materiales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costo_mano_obra" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costo_equipo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "costo_transporte" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "indirectos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "utilidad" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presupuesto_items" (
    "id" TEXT NOT NULL,
    "presupuesto_id" TEXT NOT NULL,
    "actividad_id" TEXT NOT NULL,
    "cantidad_proyecto" DECIMAL(12,2) NOT NULL,
    "costo_unitario_congelado" DECIMAL(12,2) NOT NULL,
    "costo_materiales_cong" DECIMAL(12,2) NOT NULL,
    "costo_mano_obra_cong" DECIMAL(12,2) NOT NULL,
    "costo_equipo_cong" DECIMAL(12,2) NOT NULL,
    "costo_transporte_cong" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "presupuesto_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "rol" NOT NULL DEFAULT 'presupuestista',
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" INTEGER NOT NULL,
    "empresa" TEXT,
    "ruc" TEXT,
    "moneda" TEXT NOT NULL DEFAULT 'NIO',
    "pct_indirectos_def" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "pct_utilidad_def" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    "pct_impuestos_def" DECIMAL(5,2) NOT NULL DEFAULT 15.00,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recursos_codigo_key" ON "recursos"("codigo");

-- CreateIndex
CREATE INDEX "historial_precios_recurso_id_fecha_idx" ON "historial_precios"("recurso_id", "fecha" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "actividades_codigo_key" ON "actividades"("codigo");

-- CreateIndex
CREATE INDEX "apu_detalle_recurso_id_idx" ON "apu_detalle"("recurso_id");

-- CreateIndex
CREATE UNIQUE INDEX "apu_detalle_actividad_id_recurso_id_key" ON "apu_detalle"("actividad_id", "recurso_id");

-- CreateIndex
CREATE UNIQUE INDEX "presupuesto_items_presupuesto_id_actividad_id_key" ON "presupuesto_items"("presupuesto_id", "actividad_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- AddForeignKey
ALTER TABLE "historial_precios" ADD CONSTRAINT "historial_precios_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "recursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apu_detalle" ADD CONSTRAINT "apu_detalle_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apu_detalle" ADD CONSTRAINT "apu_detalle_recurso_id_fkey" FOREIGN KEY ("recurso_id") REFERENCES "recursos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apu_costo_cache" ADD CONSTRAINT "apu_costo_cache_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_items" ADD CONSTRAINT "presupuesto_items_presupuesto_id_fkey" FOREIGN KEY ("presupuesto_id") REFERENCES "presupuestos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuesto_items" ADD CONSTRAINT "presupuesto_items_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
