async function main() {
  // Try env first; if missing, try to load from sibling anitrack/.env.local (local-only).
  let uri = process.env.MONGODB_URI;
  if (!uri) {
    try {
      const fs = require("fs");
      const path = require("path");
      const envPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        const line = content
          .split(/\r?\n/)
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("#") && l.startsWith("MONGODB_URI="));
        if (line) {
          let v = line.slice("MONGODB_URI=".length).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          uri = v;
        }
      }
    } catch {
      // ignore and fall back
    }
  }

  uri = uri || "mongodb://127.0.0.1:27017/anitrack";
  let mongoose;
  try {
    const { createRequire } = require("module");
    const reqFromCwd = createRequire(process.cwd() + "\\");
    mongoose = reqFromCwd("mongoose");
  } catch (e) {
    console.error("mongo-check: cannot require('mongoose') from this folder.");
    console.error("Run this script from the 'anitrack' folder where mongoose is installed.");
    process.exitCode = 2;
    return;
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 2000,
    });
    console.log("mongo-check: ok");
  } catch (e) {
    console.error("mongo-check: fail");
    console.error(e && e.message ? e.message : String(e));
    process.exitCode = 1;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  }
}

main();

