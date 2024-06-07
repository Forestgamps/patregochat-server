const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  roles: { type: String, required: true, default: 'User' },
  name: { type: String, default: '' },
  profilePicture: { type: String, default: '' }
});

module.exports = mongoose.model('User', UserSchema);
