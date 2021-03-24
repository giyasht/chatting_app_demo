var mongoose = require("mongoose");

var roomSchema = new mongoose.Schema({
  roomname: {
    type: String,
    unique: true,
  },
  messages: [
    {
      text: String,
      username: String,
      time: String
    },
  ],
});
module.exports = mongoose.model("Rooms", roomSchema);
