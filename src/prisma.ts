import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// Load environment variables BEFORE creating PrismaClient
dotenv.config();

export const prisma = new PrismaClient();
