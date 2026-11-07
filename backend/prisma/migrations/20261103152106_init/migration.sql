-- CreateEnum
CREATE TYPE "TipoCompromisso" AS ENUM ('AULA', 'OUTRO');

-- CreateEnum
CREATE TYPE "CategoriaAtividade" AS ENUM ('ESTUDO', 'BIBLIOTECA', 'ALIMENTACAO', 'SECRETARIA', 'OUTRO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "curso" TEXT,
    "consentiuLocalizacaoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compromisso" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoCompromisso" NOT NULL DEFAULT 'AULA',
    "diaSemana" INTEGER NOT NULL,
    "inicioMin" INTEGER NOT NULL,
    "fimMin" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "localId" INTEGER,

    CONSTRAINT "Compromisso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Local" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "categoria" "CategoriaAtividade" NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "abreMin" INTEGER,
    "fechaMin" INTEGER,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "localId" INTEGER NOT NULL,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Linha" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Linha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeituraLocalizacao" (
    "id" SERIAL NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precisaoMetros" DOUBLE PRECISION,
    "registradaEm" TIMESTAMP(3) NOT NULL,
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "linhaId" INTEGER NOT NULL,

    CONSTRAINT "LeituraLocalizacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Compromisso_usuarioId_diaSemana_idx" ON "Compromisso"("usuarioId", "diaSemana");

-- CreateIndex
CREATE UNIQUE INDEX "Linha_codigo_key" ON "Linha"("codigo");

-- CreateIndex
CREATE INDEX "LeituraLocalizacao_linhaId_registradaEm_idx" ON "LeituraLocalizacao"("linhaId", "registradaEm");

-- AddForeignKey
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compromisso" ADD CONSTRAINT "Compromisso_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_localId_fkey" FOREIGN KEY ("localId") REFERENCES "Local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraLocalizacao" ADD CONSTRAINT "LeituraLocalizacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeituraLocalizacao" ADD CONSTRAINT "LeituraLocalizacao_linhaId_fkey" FOREIGN KEY ("linhaId") REFERENCES "Linha"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
