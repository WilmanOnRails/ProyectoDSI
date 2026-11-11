-- AlterEnum
BEGIN;
CREATE TYPE "rol_new" AS ENUM ('administrador', 'presupuestista', 'solo_lectura');
ALTER TABLE "usuarios" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "usuarios" ALTER COLUMN "rol" TYPE "rol_new" USING ("rol"::text::"rol_new");
ALTER TYPE "rol" RENAME TO "rol_old";
ALTER TYPE "rol_new" RENAME TO "rol";
DROP TYPE "rol_old";
ALTER TABLE "usuarios" ALTER COLUMN "rol" SET DEFAULT 'presupuestista';
COMMIT;
