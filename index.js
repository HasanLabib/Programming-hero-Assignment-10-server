require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

const bcrypt = require("bcryptjs");
const saltRounds = 10;
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
    const reviewCollection = foodLoverDb.collection("reviews");
    const favoriteCollection = foodLoverDb.collection("favorites");

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
        const existingUser = await googleUserCollection.findOne(query);

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

    app.post("/add-review", async (req, res) => {
      try {
        const review = req.body;
        review.createdAt = new Date(review.createdAt);
        const result = await reviewCollection.insertOne(review);
        res.status(201).json(result);
      } catch (error) {
        res.status(500).json({ message: "Failed to add review" });
      }
    });

    app.get("/reviews", async (req, res) => {
      try {
        const { search } = req.query;
        const query = {};

        if (search) {
          query.foodName = { $regex: search, $options: "i" };
        }

        const reviews = await reviewCollection
          .find(query)
          .sort({ createdAt: -1 }) // sort by descending date
          .toArray();

        res.send(reviews);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch reviews" });
      }
    });

    app.get("/reviews/user/:email", async (req, res) => {
      const { email } = req.params;
      try {
        const reviews = await reviewCollection
          .find({ userEmail: email })
          .toArray();
        res.send(reviews);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({ message: "Failed to fetch reviews for this user" });
      }
    });
    app.get("/reviews/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const review = await reviewCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!review) {
          return res.status(404).json({ message: "Review not found" });
        }
        res.json(review);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch review" });
      }
    });

    app.delete("/reviews/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await reviewCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete review" });
      }
    });

    app.put("/reviews/:id", async (req, res) => {
      const { id } = req.params;
      const {
        foodName,
        foodImage,
        restaurant,
        location,
        city,
        rating,
        reviewText,
        userEmail,
        userName,
        createdAt,
      } = req.body;
      try {
        const result = await reviewCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              foodName,
              foodImage,
              restaurant,
              location,
              city,
              rating,
              reviewText,
              userEmail,
              userName,
              createdAt,
            },
          }
        );
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update review" });
      }
    });

    app.post("/reviews/favorite/:reviewId", async (req, res) => {
      try {
        const { reviewId } = req.params;
        const { userEmail } = req.body;

        if (!userEmail)
          return res.status(400).json({ message: "User email required" });

        const existing = await favoriteCollection.findOne({
          userEmail,
          reviewId,
        });

        if (existing) {
          await favoriteCollection.deleteOne({ userEmail, reviewId });
          return res.json({ message: "Removed from favorites" });
        }

        await favoriteCollection.insertOne({
          userEmail,
          reviewId,
          createdAt: new Date(),
        });

        res.json({ message: "Added to favorites" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to toggle favorite" });
      }
    });

    app.get("/reviews/favorites/:userEmail", async (req, res) => {
      try {
        const { userEmail } = req.params;
        const favoriteReviews = await favoriteCollection
          .find({ userEmail })
          .toArray();
        const favoriteIds = favoriteReviews.map(
          (favReview) => favReview.reviewId
        );
        res.send(favoriteIds);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch favorites" });
      }
    });

    app.get("/favorites/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const favorites = await favoriteCollection
          .find({ userEmail: email })
          .toArray();
        const favoriteIds = favorites.map((f) => new ObjectId(f.reviewId));

        const reviews = await reviewCollection
          .find({ _id: { $in: favoriteIds } })
          .toArray();

        res.send(reviews);
      } catch (error) {
        res.status(500).json({ message: "Failed to load favorites" });
      }
    });

    app.delete("/favorites/:reviewId", async (req, res) => {
      try {
        const { reviewId } = req.params;
        const { userEmail } = req.query;

        await favoriteCollection.deleteOne({
          reviewId,
          userEmail,
        });

        res.json({ message: "Removed from favorites" });
      } catch (error) {
        res.status(500).json({ message: "Failed to remove favorite" });
      }
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
