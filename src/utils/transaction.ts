import mongoose, { type ClientSession } from "mongoose";

export async function runInTransaction<T>(
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  let result: T | undefined;

  try {
    await session.withTransaction(
      async () => {
        result = await operation(session);
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        readPreference: "primary"
      }
    );

    if (result === undefined) {
      throw new Error("Transaction completed without returning a result");
    }

    return result;
  } finally {
    await session.endSession();
  }
}
