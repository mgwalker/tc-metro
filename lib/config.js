import { configDotenv } from "dotenv";
configDotenv();

process.env.PORT = process.env.PORT ?? 8080;
process.env.STORAGE_PATH = process.env.STORAGE_PATH ?? "./transit";
