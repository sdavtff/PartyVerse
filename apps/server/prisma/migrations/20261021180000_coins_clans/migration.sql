-- Moedas e itens da loja
ALTER TABLE "User" ADD COLUMN "coins" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "UserItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "boughtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserItem_userId_itemId_key" ON "UserItem"("userId", "itemId");
ALTER TABLE "UserItem" ADD CONSTRAINT "UserItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prêmios do torneio da semana
CREATE TABLE "WeeklyAward" (
    "id" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyAward_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeeklyAward_week_place_key" ON "WeeklyAward"("week", "place");
CREATE INDEX "WeeklyAward_userId_idx" ON "WeeklyAward"("userId");

-- Clãs
CREATE TABLE "Clan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Clan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Clan_tag_key" ON "Clan"("tag");

CREATE TABLE "ClanMember" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClanMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClanMember_userId_key" ON "ClanMember"("userId");
CREATE INDEX "ClanMember_clanId_idx" ON "ClanMember"("clanId");
ALTER TABLE "ClanMember" ADD CONSTRAINT "ClanMember_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "Clan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClanMember" ADD CONSTRAINT "ClanMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
