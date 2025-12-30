/*
  Warnings:

  - A unique constraint covering the columns `[sectionId]` on the table `Quize` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Option" DROP CONSTRAINT "Option_questionId_fkey";

-- DropForeignKey
ALTER TABLE "Question" DROP CONSTRAINT "Question_quizeId_fkey";

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "originalPrice" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "Quize_sectionId_key" ON "Quize"("sectionId");

-- AddForeignKey
ALTER TABLE "Quize" ADD CONSTRAINT "Quize_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_quizeId_fkey" FOREIGN KEY ("quizeId") REFERENCES "Quize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
