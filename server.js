const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv')
const bodyParser = require("body-parser");
const pool = require("././app/config/dbconfig")
const app = express();
const port = 5021;
const socketIo = require('socket.io');
const http = require('http');

dotenv.config();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
  methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH'],
}));

app.use(express.json())

app.use("/user", require("./app/routes/users/userRoutes"))
app.use("/questions", require("./app/routes/questions/questionRoutes"))
app.use("/answers", require("./app/routes/answers/answersRoutes"))
app.use("/images", require("./app/routes/images/imageRoutes"))
app.use("/user/log", require("./app/routes/usercardlog/userCardLogRoutes"))
app.use("/calls", require("./app/routes/calling/callRoutes"))
app.use("/connections", require("./app/routes/connections/connectionRoutes"))
app.use("/chats", require("./app/routes/chats/chatRoutes"))
app.use("/users", require("./app/routes/reports/reportRoutes"))
app.use("/notifications", require("./app/routes/notifications/notificationRoutes"))
app.use("/user", require("./app/routes/disqualifyuser/disqualifyUserRoutes"))
app.use("/chat", require("./app/routes/chatreview/chatReviewRoutes"))
app.use("/joker", require("./app/routes/sendjoker/sendJokerRoutes"))
app.use("/advertisement", require("./app/routes/advertisement/advertizementRoutes"))
app.use("/subscription", require("./app/routes/subscription/subscriptionRoutes"))
app.use("/session", require("./app/routes/aicoach/aiCoachSessionRoutes"))

app.get('/', (req, res) => {
  res.json({ message: 'Fate!' });
});

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: '*',
    credentials: true,
  },
});


app.get('/messages/v1/getAll', async (req, res) => {
  // WHERE deleted_from = false
  try {
    const result = await pool.query('SELECT * FROM chats  WHERE deleted_from = false');
    res.json({ msg: "All messges fetched", error: false, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Error fetching messages from the database:', error);
    res.status(500).json({ error: true, msg: 'Internal Server Error' });
  }
});

app.get('/messages/v1/getByUser/:senderId', async (req, res) => {
  const senderId = req.params.senderId;

  try {
    const result = await pool.query(
      `SELECT 
              u.id as receiver_id,
              u.name as receiver_name,
              u.email as receiver_email,
              u.profile_image as receiver_profile_image,
              MAX(c.message) as last_message,
              MAX(c.created_at) as created_at,
              COUNT(CASE WHEN c.read_status = FALSE THEN 1 END) as unread_status
          FROM 
              users u
          LEFT JOIN chats c ON u.id = c.receiver_id
          WHERE 
              c.sender_id = $1
          GROUP BY 
              u.id, u.name, u.email, u.profile_image
          ORDER BY 
              MAX(c.created_at) DESC`,
      [senderId]
    );

    if (result.rows.length > 0) {
      res.json({ error: false, data: result.rows });
    } else {
      res.status(404).json({ error: true, msg: 'No contacts found for the sender' });
    }
  } catch (error) {
    console.error('Error fetching sender contacts:', error);
    res.status(500).json({ error: true, msg: 'Internal server error' });
  }
});

app.put('/messages/v1/updateReadStatus', async (req, res) => {
  const { senderId, receiverId } = req.body;

  try {
    // Update the read status
    const result = await pool.query(
      'UPDATE chats SET read_status = TRUE WHERE sender_id = $1 AND receiver_id = $2',
      [senderId, receiverId]
    );

    if (result.rowCount > 0) {
      // Fetch sender details
      const senderResult = await pool.query('SELECT * FROM users WHERE id = $1', [senderId]);
      const sender = senderResult.rows[0];

      // Fetch receiver details
      const receiverResult = await pool.query('SELECT * FROM users WHERE id = $1', [receiverId]);
      const receiver = receiverResult.rows[0];

      // Construct response object
      const data = {
        sender: sender,
        receiver: receiver
      };

      res.json({ error: false, msg: 'Read status updated successfully', data: data });
    } else {
      res.status(404).json({ error: true, msg: 'No messages found with the given sender and receiver' });
    }
  } catch (error) {
    console.error('Error updating read status:', error);
    res.status(500).json({ error: true, msg: 'Internal server error' });
  }
});

app.get('/messages/v1/getByUsers/:senderId/:receiverId', async (req, res) => {
  const { senderId, receiverId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM chats WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) AND deleted_from = false ORDER BY created_at ASC',
      [senderId, receiverId]
    );

    if (result.rowCount === 0) {
      // No matching records found or all matching records have deleted_from as true
      res.status(404).json({ error: true, msg: 'Chat not found' });
    } else {
      res.json({ msg: "Messages fetched for the sender and receiver", error: false, data: result.rows });
    }
  } catch (error) {
    console.error('Error fetching messages for the sender and receiver from the database:', error);
    res.status(500).json({ error: true, msg: 'Internal Server Error' });
  }
});

app.delete('/messages/v1/deleteChat/:senderId/:receiverId', async (req, res) => {
  const { senderId, receiverId } = req.params;

  try {
    const result = await pool.query(
      'UPDATE chats SET deleted_from = true WHERE sender_id = $1 AND receiver_id = $2 RETURNING *',
      [senderId, receiverId]
    );

    if (result.rowCount === 0) {
      // No matching records found
      res.status(404).json({ error: true, msg: 'No matching records found for the given sender and receiver IDs' });
    } else {
      res.json({ msg: 'Messages marked as deleted for the sender and receiver', error: false, data: result.rows });
    }
  } catch (error) {
    console.error('Error updating deleted_from status in the database:', error);
    res.status(500).json({ error: true, msg: 'Internal Server Error' });
  }
});

const socketToUser = {};
let messageCount = {}; // to track message count between users

// Array of predefined prompt messages
const promptMessages = [
  "Passionate foodie seeking someone to explore new culinary delights with.",
  "Adventure enthusiast seeking a partner in crime for hiking, camping, and spontaneous road trips.",
  "Book lover looking for someone to share cozy nights in, discussing literature and sipping wine.",
  "Music aficionado searching for a concert buddy to groove with at live shows.",
  "Travel junkie seeking a fellow explorer to create unforgettable memories around the globe.",
  "Fitness fanatic looking for a workout partner to motivate and challenge each other.",
  "Tech enthusiast eager to geek out over the latest gadgets and binge-watch sci-fi series.",
  "Animal lover seeking someone to cuddle with furry friends and explore pet-friendly spots.",
  "Art aficionado hoping to find a muse to create, appreciate, and share cultural experiences.",
  "Film buff seeking a popcorn partner to binge-watch classic films and discover hidden gems together."
];

// Function to send prompt message
async function sendPromptMessage(sender_id, receiver_id) {
  // Randomly select a prompt message from the array
  const randomIndex = Math.floor(Math.random() * promptMessages.length);
  const randomPrompt = promptMessages[randomIndex];

  try {
    const result = await pool.query(
      'INSERT INTO chats (sender_id, receiver_id, prompt) VALUES ($1, $2, $3) RETURNING *',
      [sender_id, receiver_id, randomPrompt]
    );

    io.emit('prompt message', { sender_id, receiver_id, prompt: randomPrompt });
  } catch (error) {
    console.error('Error inserting prompt message into database:', error);
  }
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socketToUser[socket.id]}`);
    const disconnectedUserId = socketToUser[socket.id];
    if (disconnectedUserId) {
      io.emit('user disconnected', { userId: disconnectedUserId });
      delete socketToUser[socket.id];
    }
  });

  socket.on('user login', (userId) => {
    console.log(socketToUser, userId);
    socketToUser[socket.id] = userId;
    io.emit('user connected', { userId });
    console.log(`User connected: ${userId}`);
  });

  socket.on('chat message', async (data) => {
    const { sender_id, receiver_id, message, image_url } = data;

    console.log(data);

    const timestamp = new Date().toISOString();

    try {
      const result = await pool.query(
        'INSERT INTO chats (sender_id, receiver_id, message, image_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [sender_id, receiver_id, message, image_url]
      );

      // Increment message count between sender and receiver
      const key = sender_id < receiver_id ? `${sender_id}-${receiver_id}` : `${receiver_id}-${sender_id}`;
      messageCount[key] = (messageCount[key] || 0) + 1;

      io.emit('chat message', {
        sender_id,
        receiver_id,
        message,
        image_url,
        timestamp,
      });

      console.log(sender_id, receiver_id, message, image_url);

      // Check if message count reaches 5
      if (messageCount[key] === 5) {
        sendPromptMessage(sender_id, receiver_id);
        // Reset message count after sending the prompt
        messageCount[key] = 0;
      }
    } catch (error) {
      console.error('Error inserting message into database:', error);
    }
  });
});

// ######################################

const OpenAI = require("openai")

const openai = new OpenAI({
  apiKey: "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",
});


app.post('/getResponse', async (req, res) => {
  const {
    sentence1,
    sentence2
  } = req.body
  const content = "Can u tell me just percentage score of similarity between these 2 sentences";
  const concatenatedStatement = `${content} \"${sentence1}\" , \"${sentence2}\"`;
  console.log(concatenatedStatement)
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        "role": "system",
        "content": `${concatenatedStatement}`
      },
      {
        "role": "user",
        "content": "\n"
      }
    ],
    temperature: 1,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  res.json(response)
});

server.listen(port, () => {
  console.log(`Fate is running on port ${port}.`);
}); 