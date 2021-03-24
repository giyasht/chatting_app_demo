var express = require("express"),
  app = express(),
  http = require("http"),
  server = http.createServer(app),
  socketio = require("socket.io"),
  io = socketio(server),
  mongoose = require("mongoose"),
  bodyParser = require("body-parser"),
  LocalStrategy = require("passport-local"),
  passport = require("passport"),
  passportLocalMongoose = require("passport-local-mongoose");

var Rooms = require("./models/roommodel");
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers,
} = require("./utils/users");

const formatMessage = require("./utils/messages");

const path = require("path");
app.use(express.static(path.join(__dirname + "/public")));

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

app.use(
  require("express-session")({
    secret: "chatting-app",
    resave: false,
    saveUninitialized: false,
  })
);

mongoose.connect(
  process.env.DATABASEURL || "mongodb://localhost/chatting",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
  },
  () => {
    console.log("db connected successfully");
  }
);

var UserSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
  },
  password: String,
  friends: [
    {
      friends_username: String,
      friends_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },
  ],
});

UserSchema.plugin(passportLocalMongoose);

var User = mongoose.model("User", UserSchema);

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", (req, res) => {
  res.redirect("/login");
});
app.get("/login", (req, res) => {
  res.render("login");
});
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/friends",
    failureRedirect: "/login",
  }),
  (req, res) => {
    console.log("logged in");
  }
);
app.get("/register", (req, res) => {
  res.render("register");
});
app.post("/register", (req, res) => {
  var newUser = new User({
    username: req.body.username,
  });
  User.register(newUser, req.body.password, function (err, createdUser) {
    if (err) {
      console.log("error 1");
      console.log(err);
    }
    passport.authenticate("local")(req, res, () => {
      console.log(createdUser);
      console.log(typeof createdUser.friends);
      res.redirect("/friends");
    });
  });
});
app.get("/friends", (req, res) => {
  console.log(req.user);

  res.render("friends", { user: req.user });
});
app.post("/newfriend", (req, res) => {
  User.findOne(
    { username: req.body.friends_username },
    function (err, foundFriend) {
      if (err) {
        console.log("error 2");
        console.log(err);
      } else {
        User.findById(req.user._id, (err, foundUser) => {
          if (err) {
            console.log(err);
          } else {
            console.log("Found user", foundUser);
            console.log("Found friend", foundFriend);
            foundUser.friends.push({
              friends_username: foundFriend.username,
              friends_id: foundFriend.id,
            });
            foundUser.save();

            foundFriend.friends.push({
              friends_username: foundUser.username,
              friends_id: foundUser.id,
            })
            foundFriend.save();

            console.log("Found user", foundUser);
            console.log("Found friend", foundFriend);

            res.redirect("/friends");
          }
        });
      }
    }
  );
});

var botName = "C bot";
io.on("connection", (socket) => {
  console.log("connection established");
  socket.on("joinRoom", ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    socket.join(user.room);
    console.log(user);

    socket.emit(
      "message",
      formatMessage(
        botName,
        `Hello ${user.username}, welcome to room ${user.room}!`
      )
    );
  });

  // Listen for chatMessage
  socket.on("chatMessage", (msg) => {
    const user = getCurrentUser(socket.id);
    console.log(`Current user: ${user}`);
    if (msg) {
      io.to(user.room).emit("message", formatMessage(user.username, msg));
    }
  });

  // Runs when client disconnects
  socket.on("disconnect", () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        formatMessage(botName, `${user.username} has left the chat`)
      );
    }
  });
});

app.get("/chatting/:roomname", (req, res, next) => {
  res.render("messages", { user: req.user, room: req.params.roomname });
});

var PORT = process.env.PORT || 3020;
server.listen(PORT, () => {
  console.log(`server at port ${PORT}`);
});
