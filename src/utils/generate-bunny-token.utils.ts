import crypto from "crypto";
import { logger } from "../config/logger.config";

export function generateBunnyToken(videoGuid: string) {
    const tokenSecret = process.env.BUNNY_TOKEN_SECRET!;
    const expires = Math.floor(Date.now() / 1000) + 600;
    logger.info(tokenSecret);
    const token = crypto
        .createHash("sha256")
        .update(videoGuid + expires + tokenSecret)
        .digest("hex");

    return { token, expires };
}

