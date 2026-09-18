import { MongoClient, ObjectId } from "mongodb";
import { getAuthConfig } from "./authConfig";

export { ObjectId };

// Serverless functions can be invoked many times on the same warm instance,
// so the client (and its connection pool) is cached on `global` instead of
// module-scope — module-scope alone can still get re-evaluated across hot
// reloads in dev, wiping the cache every time and reconnecting needlessly.
const globalForMongo = global as unknown as { _mongoClientPromise?: Promise<MongoClient> };

function getClientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    const { mongoUri } = getAuthConfig();
    globalForMongo._mongoClientPromise = new MongoClient(mongoUri).connect();
  }
  return globalForMongo._mongoClientPromise;
}

export interface UserDoc {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export async function usersCollection() {
  const client = await getClientPromise();
  const { mongoDbName } = getAuthConfig();
  return client.db(mongoDbName).collection<UserDoc>("users");
}
