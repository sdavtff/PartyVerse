-- Conteúdo do Desafio do dia (gerado por IA ou pelo banco reserva), um registro por dia
CREATE TABLE "DailyChallenge" (
    "day" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyChallenge_pkey" PRIMARY KEY ("day")
);
