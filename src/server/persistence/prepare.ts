import "server-only";
import { dbConnect } from "./connection";
import { User } from "./user";
import { Meal } from "./meal";

export async function prepareDatabase(): Promise<void> {
  await dbConnect();
  // createIndexes adds missing indexes. syncIndexes would delete consumer indexes.
  await User.createCollection();
  await Meal.createCollection();
  await User.createIndexes();
  await Meal.createIndexes();
}
