import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { MockNID } from "../models/MockNID.js";

const records = [
  { nidNumber: "1987654321", dateOfBirth: "1990-05-14", name: "Rahim Uddin" },
  { nidNumber: "2876543210", dateOfBirth: "1987-11-02", name: "Karim Hasan" },
  { nidNumber: "3765432109", dateOfBirth: "1995-02-21", name: "Sadia Akter" },
  { nidNumber: "4654321098", dateOfBirth: "1983-08-30", name: "Farhan Ahmed" },
  { nidNumber: "4654321099", dateOfBirth: "2003-01-04", name: "Taha Rukaiya" },
  { nidNumber: "2465432009", dateOfBirth: "1999-02-21", name: "Keya Akter" },
  { nidNumber: "4654325678", dateOfBirth: "2000-08-30", name: "Maria Ahmed" },
  { nidNumber: "4634521098", dateOfBirth: "2004-01-04", name: "Habiba Rahman" },
];

await connectDatabase();
await MockNID.bulkWrite(
  records.map((record) => ({
    updateOne: {
      filter: { nidNumber: record.nidNumber },
      update: { $set: record },
      upsert: true,
    },
  })),
);
console.log(`Seeded ${records.length} MockNID records`);
await mongoose.disconnect();
