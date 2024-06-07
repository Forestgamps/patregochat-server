const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
    username: { type: String, required: true },
    message: { type: String, required: true },
    room: { type: String, required: true },
    __createdtime__: { type: Date, default: Date.now },
    profilePicture: { type: String, default: '' }
});

const Mess = mongoose.model('Message', messageSchema);

module.exports = Mess;