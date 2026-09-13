import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "../config/db.js";
import { MockNID } from "../models/MockNID.js";

const records = [
  { nidNumber: "1987654321", dateOfBirth: "2000-01-01", name: "Rahim Uddin" },
  { nidNumber: "2876543210", dateOfBirth: "2000-01-01", name: "Karim Hasan" },
  { nidNumber: "3765432109", dateOfBirth: "2000-01-01", name: "Sadia Akter" },
  { nidNumber: "4654321098", dateOfBirth: "2000-01-01", name: "Farhan Ahmed" },
  { nidNumber: "4654321099", dateOfBirth: "2000-01-01", name: "Taha Rukaiya" },
  { nidNumber: "2465432009", dateOfBirth: "2000-01-01", name: "Keya Akter" },
  { nidNumber: "4654325678", dateOfBirth: "2000-01-01", name: "Maria Ahmed" },
  { nidNumber: "4634521098", dateOfBirth: "2000-01-01", name: "Habiba Rahman" },
  { nidNumber: "5102938471", dateOfBirth: "2000-01-01", name: "Tanvir Hossain" },
  { nidNumber: "5213049582", dateOfBirth: "2000-01-01", name: "Nusrat Jahan" },
  { nidNumber: "5324150693", dateOfBirth: "2000-01-01", name: "Mahmudul Hasan" },
  { nidNumber: "5435261704", dateOfBirth: "2000-01-01", name: "Roksana Begum" },
  { nidNumber: "5546372815", dateOfBirth: "2000-01-01", name: "Arifur Rahman" },
  { nidNumber: "5657483926", dateOfBirth: "2000-01-01", name: "Sabrina Sultana" },
  { nidNumber: "5768594037", dateOfBirth: "2000-01-01", name: "Kazi Nazrul Islam" },
  { nidNumber: "5879605148", dateOfBirth: "2000-01-01", name: "Shamima Nasrin" },
  { nidNumber: "5980716259", dateOfBirth: "2000-01-01", name: "Zubair Al Mahmud" },
  { nidNumber: "6091827360", dateOfBirth: "2000-01-01", name: "Fatema Tuz Zohra" },
  { nidNumber: "6102938472", dateOfBirth: "2000-01-01", name: "Imran Khan" },
  { nidNumber: "6213049583", dateOfBirth: "2000-01-01", name: "Anika Tabassum" },
  { nidNumber: "6324150694", dateOfBirth: "2000-01-01", name: "Ashraful Alam" },
  { nidNumber: "6435261705", dateOfBirth: "2000-01-01", name: "Mst Sharmin Akter" },
  { nidNumber: "6546372816", dateOfBirth: "2000-01-01", name: "Golam Mostafa" },
  { nidNumber: "6657483927", dateOfBirth: "2000-01-01", name: "Tanjina Islam" },
  { nidNumber: "6768594038", dateOfBirth: "2000-01-01", name: "Mehedi Hasan Miraz" },
  { nidNumber: "6879605149", dateOfBirth: "2000-01-01", name: "Tasnim Ferdous" },
  { nidNumber: "6980716250", dateOfBirth: "2000-01-01", name: "Samiul Haque" },
  { nidNumber: "7091827361", dateOfBirth: "2000-01-01", name: "Farzana Boby" },
  { nidNumber: "7102938473", dateOfBirth: "2000-01-01", name: "Al Amin Sheikh" },
  { nidNumber: "7213049584", dateOfBirth: "2000-01-01", name: "Jannatul Ferdous" },
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
