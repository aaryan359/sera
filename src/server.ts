import express from "express";
import cors from "cors";


const app = express();


app.use(express.json());


app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));




app.listen(4999, () => {
    console.log("Server is running on port 4999");
});

