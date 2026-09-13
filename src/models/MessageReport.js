import mongoose from ""mongoose"";

const messageReportSchema = new mongoose.Schema(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: ""JobChat"", required: true, index: true },
    messageId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: ""User"", required: true, index: true },
    reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: ""User"", required: true, index: true },
    reason: {
      type: String,
      required: true,
      enum: [""harassment"", ""inappropriate_language"", ""attempted_circumvention"", ""scam"", ""spam"", ""other""],
    },
    snapshotContent: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: [""pending"", ""reviewed"", ""actioned"", ""dismissed""], default: ""pending"", index: true },
    adminNote: { type: String, maxlength: 1000, default: """" },
  },
  { timestamps: true },
);

messageReportSchema.index({ chatId: 1, messageId: 1, reporterId: 1 }, { unique: true });

export const MessageReport = mongoose.model(""MessageReport"", messageReportSchema);
