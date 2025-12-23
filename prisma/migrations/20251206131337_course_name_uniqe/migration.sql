/*
  Warnings:

  - A unique constraint covering the columns `[title]` on the table `Course` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bunnyVideoId` to the `Lesson` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "bunnyVideoId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Course_title_key" ON "Course"("title");
