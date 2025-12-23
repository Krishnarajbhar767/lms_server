/*
  Warnings:

  - You are about to drop the column `passwordResetToken` on the `Course` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Course" DROP COLUMN "passwordResetToken";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetToken" TEXT;
