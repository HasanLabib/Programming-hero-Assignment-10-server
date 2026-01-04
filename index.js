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
    //await client.connect();
    const foodLoverDb = client.db("foodLoverDb");
    const userCollection = foodLoverDb.collection("users");
    const googleUserCollection = foodLoverDb.collection("googleusers");
    const reviewCollection = foodLoverDb.collection("reviews");
    const favoriteCollection = foodLoverDb.collection("favorites");
    const contactCollection = foodLoverDb.collection("contacts");

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
    app.get("/users", async (req, res) => {
      try {
        const users = await userCollection.find().toArray();

        res.send(users);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
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
        const { search, page = 1, limit = 8 } = req.query;

        const query = {};

        if (search) {
          query.foodName = { $regex: search, $options: "i" };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const totalCount = await reviewCollection.countDocuments(query);

        const reviews = await reviewCollection
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send({
          totalCount,
          reviews,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch reviews" });
      }
    });
    app.get("/top-reviews", async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();

        res.send({
          reviews: reviews,
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch top reviews" });
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

    app.get("/top-reviews", async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find()
          .sort({ rating: -1 })
          .limit(6)
          .toArray();

        res.send(reviews);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch top reviews" });
      }
    });
    app.get("/reviews/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const review = await reviewCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(review);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch review" });
      }
    });

    app.get("/explore", async (req, res) => {
      try {
        const {
          search = "",
          category,
          city,
          sort = "newest",
          page = 1,
          limit = 8,
        } = req.query;

        const query = {};
        if (search) {
          query.$or = [
            { foodName: { $regex: search, $options: "i" } },
            { restaurant: { $regex: search, $options: "i" } },
          ];
        }
        if (category && category !== "All") {
          query.category = { $regex: `^${category}$`, $options: "i" };
        }

        if (city && city !== "All") {
          query.city = city;
        }
        let sortQuery = { createdAt: -1 }; // newest
        if (sort === "rating") sortQuery = { rating: -1 };

        const skip = (Number(page) - 1) * Number(limit);

        const reviews = await reviewCollection
          .find(query)
          .sort(sortQuery)
          .skip(skip)
          .limit(Number(limit))
          .toArray();

        const total = await reviewCollection.countDocuments(query);

        res.send({
          reviews,
          total,
          currentPage: Number(page),
          totalPages: Math.ceil(total / limit),
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load explore data" });
      }
    });

    app.get("/dashboard/user-stats/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const reviewCount = await reviewCollection.countDocuments({
          userEmail: email,
        });

        const favoriteCount = await favoriteCollection.countDocuments({
          userEmail: email,
        });

        const userReviews = await reviewCollection
          .find({ userEmail: email })
          .toArray();

        const ratingDistribution = [
          { rating: 1, count: 0 },
          { rating: 2, count: 0 },
          { rating: 3, count: 0 },
          { rating: 4, count: 0 },
          { rating: 5, count: 0 },
        ];

        userReviews.forEach((review) => {
          const rating = Math.round(Number(review.rating));

          if (rating >= 1 && rating <= 5) {
            ratingDistribution[rating - 1].count++;
          }
        });

        res.json({
          totalReviews: reviewCount,
          totalFavorites: favoriteCount,
          ratingDistribution,
        });
      } catch (error) {
        console.error("USER STATS ERROR 👉", error);
        res.status(500).json({
          message: "Failed to fetch user stats",
          error: error.message,
          stack: error.stack,
        });
      }
    });

    app.get("/dashboard/admin-stats", async (req, res) => {
      try {
        // 1️⃣ Simple counts
        const totalUsers = await userCollection.countDocuments();
        const totalReviews = await reviewCollection.countDocuments();
        const totalFavorites = await favoriteCollection.countDocuments();

        // 2️⃣ Get last 6 months reviews
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const reviews = await reviewCollection
          .find({ createdAt: { $gte: sixMonthsAgo } })
          .toArray();

        // 3️⃣ Prepare months map
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const monthMap = {};

        reviews.forEach((review) => {
          const date = new Date(review.createdAt);
          const month = monthNames[date.getMonth()];

          if (!monthMap[month]) {
            monthMap[month] = 0;
          }
          monthMap[month]++;
        });

        // 4️⃣ Convert map → array (for recharts)
        const monthlyData = Object.keys(monthMap).map((month) => ({
          month,
          reviews: monthMap[month],
        }));

        // 5️⃣ Send response
        res.json({
          totalUsers,
          totalReviews,
          totalFavorites,
          monthlyData,
        });
      } catch (error) {
        console.error("ADMIN STATS ERROR:", error);
        res.status(500).json({ message: "Failed to fetch admin stats" });
      }
    });

    app.get("/dashboard/recent-reviews/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const { limit = 5 } = req.query;

        const reviews = await reviewCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 })
          .limit(parseInt(limit))
          .toArray();

        res.json(reviews);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch recent reviews" });
      }
    });

    app.get("/dashboard/top-restaurants/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const topRestaurants = await reviewCollection
          .aggregate([
            { $match: { userEmail: email } },
            {
              $group: {
                _id: "$restaurant",
                count: { $sum: 1 },
                avgRating: { $avg: "$rating" },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ])
          .toArray();

        const formattedData = topRestaurants.map((item) => ({
          name: item._id,
          reviews: item.count,
          avgRating: parseFloat(item.avgRating.toFixed(1)),
        }));

        res.json(formattedData);
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to fetch top restaurants" });
      }

      app.get("/reviews/:id", async (req, res) => {
        try {
          const { id } = req.params;

          const review = await reviewsCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!review) {
            return res.status(404).send({ message: "Review not found" });
          }

          res.send(review);
        } catch (error) {
          res.status(500).send({ message: "Invalid ID" });
        }
      });
    });

    app.get("/dashboard/admin-rating-distribution", async (req, res) => {
      try {
        const reviews = await reviewCollection.find().toArray();

        const ratingDistribution = [
          { rating: 1, count: 0 },
          { rating: 2, count: 0 },
          { rating: 3, count: 0 },
          { rating: 4, count: 0 },
          { rating: 5, count: 0 },
        ];

        reviews.forEach((review) => {
          const rating = Math.round(Number(review.rating));
          if (rating >= 1 && rating <= 5) {
            ratingDistribution[rating - 1].count++;
          }
        });

        res.json(ratingDistribution);
      } catch (error) {
        res.status(500).json({ message: "Failed to load rating distribution" });
      }
    });

    app.get("/dashboard/admin-reviews-over-time", async (req, res) => {
      try {
        const reviews = await reviewCollection.find().toArray();

        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        const monthMap = {};

        reviews.forEach((review) => {
          const date = new Date(review.createdAt);
          const month = monthNames[date.getMonth()];
          monthMap[month] = (monthMap[month] || 0) + 1;
        });

        const monthlyData = Object.keys(monthMap).map((month) => ({
          month,
          reviews: monthMap[month],
        }));

        res.json(monthlyData);
      } catch (error) {
        res.status(500).json({ message: "Failed to load review trends" });
      }
    });

    app.get("/dashboard/admin-recent-reviews", async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(5)
          .toArray();

        res.json(reviews);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch recent reviews" });
      }
    });

    app.post("/contact", async (req, res) => {
      try {
        const { name, email, subject, message } = req.body;

        if (!name || !email || !message) {
          return res.status(400).json({ message: "All fields are required" });
        }

        const contactData = {
          name,
          email,
          subject,
          message,
          createdAt: new Date(),
        };

        await contactCollection.insertOne(contactData);

        res.status(201).json({ message: "Message saved successfully" });
      } catch (error) {
        console.error("CONTACT ERROR:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    });

    app.get("/dashboard/contact-messages", async (req, res) => {
      try {
        const messages = await contactCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        res.send(messages);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    });

    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
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
