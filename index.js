require("dotenv").config({ quite: true });
const express = require("express");
const { default: mongoose } = require("mongoose");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

const numberUsersPerPage = 5;

// Userschema
const Userschema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Tên không được để trống"],
    minlength: [2, "Tên phải có ít nhất 2 ký tự"],
  },
  age: {
    type: Number,
    min: [0, "Tuổi phải >= 0"],
    required: [true, "Tuổi không được để trống"],
  },
  email: {
    type: String,
    unique: true,
    required: [true, "Email không được để trống"],
    match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
  },
  address: { type: String },
  createAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", Userschema);

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

app.get("/", async (req, res) => {
  return res.status(200).json({
    message: "Server running",
  });
});

app.get("/api/users", async (req, res) => {
  try {
    const { page = 1, limit = 5, search = "" } = req.query;
    const skip = (page - 1) * limit;
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { address: { $regex: search, $options: "i" } },
          ],
        }
      : {};
    const users = await User.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createAt: -1 });
    const total = await User.countDocuments(filter);
    return res.status(200).json({
      data: users,
      total,
      totalPages: Math.ceil(total / limit),
      page,
      limit,
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", async (req, res) => {
  const { name, age, email, address } = req.body;
  try {
    const newUser = new User({
      name: name,
      age: age,
      email: email,
      address: address,
    });

    await newUser.save();
    return res.status(201).json({
      message: "Tạo người dùng thành công",
      data: newUser,
    });
  } catch (error) {
    console.log("Error", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email đã tồn tại" });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }
    return res.status(400).json({ error: error.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  const { id } = req.params;
  const { name, age, email, address } = req.body;

  if (!isValidId(id)) {
    return res.status(400).json({ message: "Invalid user id" });
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (age !== undefined) updateData.age = age;
  if (email !== undefined) updateData.email = email;
  if (address !== undefined) updateData.address = address;

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ message: "No data to update" });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    return res.status(200).json({
      message: "Cập nhật người dùng thành công",
      data: updatedUser,
    });
  } catch (error) {
    console.log("Error", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email đã tồn tại" });
    }
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ message: "ID không hợp lệ" });
  }

  try {
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    return res.status(200).json({
      message: "Xóa người dùng thành công",
    });
  } catch (error) {
    console.log("Error", error);
    return res.status(400).json({ error: error.message });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(port, () => {
      console.log(`Server running on  http://localhost:3001`);
    });
  })
  .catch((err) => {
    console.error("Connection error: ", err);
    process.exit(1);
  });
