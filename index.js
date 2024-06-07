const express = require('express');
const app = express();
const fileUpload = require('express-fileupload');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const Mess = require('./models/message');
const User = require('./models/user');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

app.use(cors()); // Add cors middleware

const server = http.createServer(app);
app.use(express.json());
app.use(fileUpload());
app.use('/uploads', express.static('uploads'));


const db = process.env.DB_URL;

mongoose
  .connect(db, {useNewUrlParser: true, useUnifiedTopology: true,})
  .then((res) => console.log('Connected to DB'))
  .catch((error) => console.log(error));

const CHAT_BOT = 'ChatBot';
const leaveRoom = require('./utils/leave-room');
let chatRoom = '';
let allUsers = []; // Все пользователи комнаты

const JWT_SECRET = 'bro';

const io = new Server(server, {
  cors: {
    //origin: 'http://localhost:3000',
    origin: 'https://patregochat-client.onrender.com/',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`User connected ${socket.id}`);

  // We can write our socket event listeners in here...
// Add a user to a room
  socket.on('join_room', (data) => {
    const { username, room, profilePicture } = data; // Data sent from client when join_room event emitted

    const userAlreadyInRoom = allUsers.find(
      (user) => user.username === username && user.room === room
    );

    if (userAlreadyInRoom) {
      socket.emit('receive_message', {
        message: `You are already in the room ${room}`,
        username: CHAT_BOT,
        __createdtime__: Date.now(),
      });
      return;
    }

    socket.join(room); // Join the user to a socket room

    let __createdtime__ = Date.now(); // Current timestamp
    // Send message to all users currently in the room, apart from the user that just joined
    socket.to(room).emit('receive_message', {
      message: `${username} has joined the chat room`,
      username: CHAT_BOT,
      __createdtime__,
    });

    socket.emit('receive_message', {
      message: `Welcome ${username}`,
      username: CHAT_BOT,
      __createdtime__,
    });

    // Fetch and send all previous messages in the room using promises
    Mess.find({ room }).sort({ __createdtime__: 1 }).then((messages) => {
      socket.emit('previous_messages', messages);
    }).catch((err) => {
      console.error('Error fetching previous messages:', err);
    });

    
    // Save the new user to the room
    chatRoom = room;
    allUsers.push({ id: socket.id, username, room });
    chatRoomUsers = allUsers.filter((user) => user.room === room);
    socket.to(room).emit('chatroom_users', chatRoomUsers);
    socket.emit('chatroom_users', chatRoomUsers);
  });

  socket.on('send_message', (data) => {
    const { message, username, room, __createdtime__, profilePicture } = data;
    const mess = new Mess({message, username, room, __createdtime__, profilePicture})
    io.in(room).emit('receive_message', data); // Send to all users in room, including sender
    mess
      .save() // Save message in db
      .then((response) => console.log(response))
      .catch((err) => console.log(err));
  });

  socket.on('leave_room', (data) => {
    const { username, room } = data;
    socket.leave(room);
    const __createdtime__ = Date.now();
    // Remove user from memory
    allUsers = leaveRoom(socket.id, allUsers);
    socket.to(room).emit('chatroom_users', allUsers);
    socket.to(room).emit('receive_message', {
      username: CHAT_BOT,
      message: `${username} has left the chat`,
      __createdtime__,
    });
    console.log(`${username} has left the chat`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected from the chat');
    const user = allUsers.find((user) => user.id == socket.id);
    if (user?.username) {
      allUsers = leaveRoom(socket.id, allUsers);
      socket.to(chatRoom).emit('chatroom_users', allUsers);
      socket.to(chatRoom).emit('receive_message', {
        message: `${user.username} has disconnected from the chat.`,
      });
    }
  });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
      const user = new User({ username, password: hashedPassword });
      await user.save();
      res.status(201).send('User registered');
  } catch (err) {
      res.status(500).send('Error registering user');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) {
      return res.status(401).send('Invalid username or password');
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
      return res.status(401).send('Invalid username or password');
  }
  const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET);
  res.json({ token });
});

app.get('/me', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token) {
      return res.status(401).send('Access denied');
  }
  try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
          return res.status(404).send('User not found');
      }
      res.json(user);
  } catch (err) {
      console.error('Error fetching user:', err);
      res.status(400).send('Invalid token');
  }
});

app.post('/upload', async (req, res) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).send('Access denied');
  }

  let uploadedFile = req.files.image;
  const filename = `${Date.now()}-${uploadedFile.name}`;
  const filePath = `./uploads/${filename}`;

  try {
    // Save the file to the desired location
    await uploadedFile.mv(filePath);

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Update user's profile picture URL
    user.profilePicture = `/uploads/${filename}`;
    await user.save();

    res.send('File uploaded and user profile updated!');
  } catch (err) {
    res.status(500).send(err);
  }
});


server.listen(4000, () => 'Server is running on port 4000');