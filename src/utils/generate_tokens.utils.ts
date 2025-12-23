import jwt from 'jsonwebtoken';


export const generateAccessToken = (userId: string): string => {
  // Generate  Access Token
  const accessToken = jwt.sign(
    {
      id: userId,
    },
    process.env.ACCESS_SECRET!,
    { expiresIn: '15m' },
  );

  return accessToken;
};


export const generateRefreshToken = (userId: string): string => {
  // Generate  Access Token
  const refreshToken = jwt.sign(
    {
      id: userId,
    },
    process.env.REFRESH_SECRET!,
    { expiresIn: '7d' },
  );

  return refreshToken;
};