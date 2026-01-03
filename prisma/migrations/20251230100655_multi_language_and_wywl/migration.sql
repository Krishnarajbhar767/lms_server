/*
  Warnings:

  - The `language` column on the `Course` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "whatYouWillLearn" TEXT[],
DROP COLUMN "language",
ADD COLUMN     "language" TEXT[];
