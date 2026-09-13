require("dotenv").config({ path: "../.env" });
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { subscriber } = require("./config/pubsub");

const pool = require("./config/database.js");
const jobRoutes = require("./routes/job.routes");
const authRoutes = require("./routes/auth.routes");
const projectRoutes = require("./routes/project.routes");
const apiRoutes = require("./routes/api.routes");


const app = express();
app.use(cors());

app.use(express.json());

app.use("/jobs", jobRoutes);
app.use("/auth", authRoutes);
app.use("/projects", projectRoutes);
app.use("/api/v1", apiRoutes);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*"
    }
});
const startServer = async () => {
    await subscriber.connect();

    await subscriber.subscribe("job-events", (message) => {
        const event = JSON.parse(message);

        io.to(`user:${event.userId}`).emit("job-event", event);
    });

    io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error("Authentication required"));
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        socket.user = decoded;

        next();

    } catch (error) {
        next(new Error("Invalid or expired token"));
    }
});

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

server.listen(3000, () => {
    console.log("Aetheris server running on port 3000");
});
};

startServer();