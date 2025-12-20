/*
  Warnings:

  - You are about to drop the column `cloud` on the `Robot` table. All the data in the column will be lost.
  - You are about to drop the column `disk` on the `Robot` table. All the data in the column will be lost.
  - You are about to drop the column `lastSeen` on the `Robot` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Robot" (
    "robotId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "status" TEXT,
    "battery" INTEGER,
    "cpu" INTEGER,
    "memory" INTEGER,
    "disk"        INTEGER,
    "temperature" INTEGER,
    "lat" REAL,
    "lng" REAL,
    "webrtclient" INTEGER,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Robot" ("cpu", "memory", "name", "robotId") SELECT "cpu", "memory", "name", "robotId" FROM "Robot";
DROP TABLE "Robot";
ALTER TABLE "new_Robot" RENAME TO "Robot";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
