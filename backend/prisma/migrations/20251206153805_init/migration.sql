-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Robot" (
    "robotId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cpu" INTEGER,
    "memory" INTEGER,
    "disk" INTEGER,
    "cloud" BOOLEAN DEFAULT true,
    "lastSeen" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
