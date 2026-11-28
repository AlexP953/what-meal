import { mongo } from "mongoose";
import { emailSchema } from "../src/lib/validations";

async function count() {
  const args = process.argv.slice(2);
  const [dbName, account, expected] = args;
  const uri = process.env.WHAT_MEAL_TEST_MONGODB_URI;
  const email = emailSchema.safeParse(account);
  const expectedMeals = Number(expected);
  if (args.length !== 3 || !uri || !/^[a-zA-Z0-9_-]{1,63}$/.test(dbName) ||
      !email.success || !email.data.endsWith("@example.com") ||
      !/^\d+$/.test(expected) || !Number.isSafeInteger(expectedMeals)) {
    throw new Error();
  }

  const client = new mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 5000,
    // Override driver diagnostics inherited from the operator's environment.
    mongodbLogComponentSeverities: {
      default: "off", command: "off", topology: "off",
      serverSelection: "off", connection: "off", client: "off",
    },
  });
  try {
    const db = client.db(dbName);
    const matches = await db.collection("users").find({ email: email.data }, {
      projection: { _id: 1 }, limit: 2,
    }).toArray();
    if (matches.length > 1) throw new Error();

    const accounts = matches.length;
    const meals = accounts === 1
      ? await db.collection("meals").countDocuments({ userId: matches[0]._id })
      : 0;
    return { accounts, meals, passed: accounts === 1 && meals === expectedMeals };
  } finally {
    await client.close();
  }
}

void count().then(result => {
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
}).catch(() => {
  console.error("Deployment count check failed. Check the inputs and the read-only connection.");
  process.exitCode = 1;
});
