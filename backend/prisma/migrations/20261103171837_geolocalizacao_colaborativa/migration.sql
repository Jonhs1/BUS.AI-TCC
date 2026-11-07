/*
  Warnings:

  - Added the required column `viagemId` to the `LeituraLocalizacao` table without a default value. This is not possible if the table is not empty.
  - Added the required column `operador` to the `Linha` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoOperador" AS ENUM ('PREFEITURA', 'EMPRESA_PRIVADA', 'TRANSPORTE_URBANO');

-- AlterTable
ALTER TABLE "LeituraLocalizacao" ADD COLUMN     "viagemId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Linha" ADD COLUMN     "cidadeOrigem" TEXT,
ADD COLUMN     "operador" "TipoOperador" NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "linhaId" INTEGER;

-- CreateTable
CREATE TABLE "Viagem" (
    "id" SERIAL NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerradaEm" TIMESTAMP(3),
    "usuarioId" INTEGER NOT NULL,
    "linhaId" INTEGER NOT NULL,

    CONSTRAINT "Viagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Viagem_linhaId_encerradaEm_idx" ON "Viagem"("linhaId", "encerradaEm");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_linhaId_fkey" FOREIGN KEY ("linhaId") REFERENCES "Linha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viagem" ADD CONSTRAINT "Viagem_linhaId_fkey" FOREIGN KEY ("linhaId") REFERENCES "Linha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraLocalizacao" ADD CONSTRAINT "LeituraLocalizacao_viagemId_fkey" FOREIGN KEY ("viagemId") REFERENCES "Viagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
