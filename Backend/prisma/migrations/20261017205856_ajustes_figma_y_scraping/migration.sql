-- AlterEnum
ALTER TYPE "rol" ADD VALUE 'ingeniero';

-- AlterTable
ALTER TABLE "proyectos" ADD COLUMN     "codigo" TEXT;

-- AlterTable
ALTER TABLE "recursos" ADD COLUMN     "imagen_url" TEXT,
ADD COLUMN     "nombre_proveedor" TEXT,
ADD COLUMN     "proveedor" TEXT,
ADD COLUMN     "url_producto" TEXT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "ultimo_acceso" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_codigo_key" ON "proyectos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "recursos_proveedor_url_producto_key" ON "recursos"("proveedor", "url_producto");
