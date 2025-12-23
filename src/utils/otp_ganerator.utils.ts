import crypto from 'crypto';
export const generateOtp = (): number => {
  const  otp =  crypto.randomInt(100000, 999999).toString();
  return  parseInt(otp)
};