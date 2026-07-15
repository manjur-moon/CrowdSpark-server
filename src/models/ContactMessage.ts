import { Schema, model } from "mongoose";

export interface IContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, maxlength: 320 },
    subject: { type: String, required: true, maxlength: 160 },
    message: { type: String, required: true, maxlength: 2000 }
  },
  { timestamps: true }
);

export const ContactMessage = model<IContactMessage>("ContactMessage", schema);
