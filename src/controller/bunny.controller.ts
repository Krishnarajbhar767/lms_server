// bunny.controller.ts
import axios from "axios";
import { Request, Response } from "express";
import asyncHandler from "../utils/async_handler.utils";
import { ValidationError } from "../utils/api_error.utils.";

import crypto from "crypto";
import { deleteBunnyVideo } from "../utils/delete-bunny-video";
const BUNNY_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_API_KEY = process.env.BUNNY_STREAM_API_KEY;
const BUNNY_TOKEN_SECRET = process.env.BUNNY_TOKEN_SECRET;
export const createBunnyVideo = asyncHandler(async (req: Request, res: Response) => {
    const title = req.body?.title;

    if (!title) {
        throw new ValidationError("Title is required");
    }

    const createRes = await axios.post(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
        { title }, // you can add collectionId, thumbnailTime, etc.
        {
            headers: {
                AccessKey: BUNNY_API_KEY,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        }
    );

    const video = createRes.data; // includes guid/videoId
    const videoId = video.guid;

    // 2) Build upload URL (for PUT binary upload)
    const uploadUrl = `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`;
    return res.success("Video created successfully", {
        videoId,
        uploadUrl,
        libraryId: BUNNY_LIBRARY_ID,
        accessKey: BUNNY_API_KEY,
    }, 201)
})

export const getBunnyConfig = asyncHandler(async (req: Request, res: Response) => {
    return res.success("Bunny config fetched", {
        libraryId: BUNNY_LIBRARY_ID,
        apiKey: BUNNY_API_KEY
    })
})

export const getEmbedUrl = asyncHandler(async (req: Request, res: Response) => {
    const libraryId = BUNNY_LIBRARY_ID
    const videoGuid = req?.params?.videoGuid
    const tokenSecret = BUNNY_TOKEN_SECRET as string

    // expires in 60 seconds
    const expires = Math.floor(Date.now() / 1000) + 60;

    const token = crypto
        .createHash("sha256")
        .update(tokenSecret + videoGuid + expires)
        .digest("hex");

    const embedUrl =
        `https://iframe.mediadelivery.net/embed/${libraryId}/${videoGuid}` +
        `?token=${token}&expires=${expires}`;

    return res.success("Token generated successfully", {
        embedUrl,
        expires,
    }, 200)
})

export const deleteLessonVideo = asyncHandler(async (req: Request, res: Response) => {
    const videoId = req?.params?.videoId
    if (!videoId) {
        throw new ValidationError("Video ID is required");
    }
    const deleteRes = await deleteBunnyVideo(videoId)
    return res.success("Video deleted successfully", deleteRes, 200)
})