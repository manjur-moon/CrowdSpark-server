import { Schema, model } from "mongoose";

export interface IProcessedStripeEvent {
  eventId: string;
  eventType: string;
  processedAt: Date;
}

const schema = new Schema<IProcessedStripeEvent>(
  {
    eventId: { type: String, required: true, unique: true },
    eventType: { type: String, required: true },
    processedAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

export const ProcessedStripeEvent = model<IProcessedStripeEvent>("ProcessedStripeEvent", schema);
