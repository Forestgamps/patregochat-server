const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roomSchema = new Schema({
    name: { type: String, required: true },
});

const room = mongoose.model('Rooms', roomSchema);

module.exports = room;