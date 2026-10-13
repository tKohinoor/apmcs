import "./setupEnv.js"; // keep first: sets the environment before the app loads
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../src/app.js";

let memoryServer = null;

export async function startDb() {
  // Fallback if the in-memory database cannot start on your computer:
  // set TEST_MONGO_URI to a database whose name ends with _test
  const external = process.env.TEST_MONGO_URI;
  let uri = external;

  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("apmcs_test");
  }

  await mongoose.connect(uri);

  // Safety net: tests wipe data, so never run them on a real database
  if (!mongoose.connection.name.endsWith("_test")) {
    const name = mongoose.connection.name;
    await mongoose.disconnect();
    throw new Error(`Refusing to run tests on "${name}". The name must end with _test.`);
  }

  if (external) await mongoose.connection.dropDatabase();

  // Build indexes (unique email, one active sprint per project) before testing
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function stopDb() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.name.endsWith("_test")) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

export { app };