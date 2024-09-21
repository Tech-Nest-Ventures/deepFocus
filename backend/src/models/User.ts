import { Document, Schema, model } from 'mongoose'

// Define the User interface
interface IUser extends Document {
  username: string
  password: string
  firstName: string
  lastName: string
  country: string
  language: string
}

// Create the User schema
const UserSchema: Schema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    match: [/.+@.+\..+/, 'Please fill a valid email address'] // Email validation
  },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  country: { type: String, required: true },
  language: { type: String, required: true }
})

// Create the User model
const User = model<IUser>('User', UserSchema)

export default User
export { IUser }
