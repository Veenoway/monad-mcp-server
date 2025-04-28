import dotenv from "dotenv";
import path from "path";
// Utiliser un chemin relatif basé sur __dirname
const envPath = path.resolve(__dirname, "../../.env");
console.error("Loading .env from:", envPath);
dotenv.config({ path: envPath });
export const config = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    pinataJwt: process.env.PINATA_JWT,
    privateKey: process.env.PRIVATE_KEY,
};
