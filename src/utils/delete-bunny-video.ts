

import axios from "axios";
const BUNNY_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID;
const BUNNY_API_KEY = process.env.BUNNY_STREAM_API_KEY;


export const deleteBunnyVideo = async (videoId: string) => {
    const deleteRes = await axios.delete(`https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`, {
        headers: {
            AccessKey: BUNNY_API_KEY,
            Accept: "application/json",
            "Content-Type": "application/json",
        },
    });
    return deleteRes.data
}