require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());
const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
app.get("/", (req, res) => {
  res.send("FoodLover server is running");
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const foodLoverDb = client.db("foodLoverDb");
    const userCollection = foodLoverDb.collection("users");
    const googleUserCollection = foodLoverDb.collection("googleusers");
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const hashedPassword = await bcrypt.hash(user?.password, saltRounds);
        user.password = hashedPassword;
        console.log(user);
        user.role = "user";
        user.createdAt = new Date();
        const email = req.body.email;
        const query = { email: email };
        const existingUser = await userCollection.findOne(query);

        if (existingUser) {
          res.send({
            message: "user already exits. do not need to insert again",
          });
        } else {
          const result = await userCollection.insertOne(user);
          res.status(201).json(result);
        }
      } catch (err) {
        res.status(500).json({ message: "Failed to save user" });
      }
    });
    app.post("/googleUsers", async (req, res) => {
      try {
        const guser = req.body;
        console.log(guser);
        guser.role = "user";
        guser.createdAt = new Date();
        const email = req.body.email;
        const query = { email: email };
        const existingUser = await userCollection.findOne(query);

        if (existingUser) {
          res.send({
            message: "user already exits. do not need to insert again",
          });
        } else {
          const result = await googleUserCollection.insertOne(guser);
          const result2 = await userCollection.insertOne(guser);
          res.status(201).json(result);
        }
      } catch (err) {
        res.status(500).json({ message: "Failed to save user" });
      }
    });
    app.get("/googleUsers", async (req, res) => {
        const users = await googleUserCollection.find().toArray();
        res.send(users);
    });



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`FoodLover server is running on port: ${port}`);
});
