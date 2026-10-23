import express from "express";
import cors from "cors";
import router from "./routes/index.ts";
import dotenv from 'dotenv';
dotenv.config();

const app = express();




app.use(express.json());


app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));





app.use("/api/v1", router);



app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});




const PORT = process.env.PORT || 3333;


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});