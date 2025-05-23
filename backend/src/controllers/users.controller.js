import User from "../models/users.models.js";
import bcrypt from "bcryptjs";

const cookiesOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export const register = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }
    const isUserExist = await User.findOne({ email });
    if (isUserExist) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, email, password });
    const CreatedUser = await User.findById(user._id).select("-password");
    const token = CreatedUser.generateToken();
    if (!token) {
      return res.status(500).json({ message: "Token generation failed" });
    }
    res
      .status(201)
      .cookie("token", token, cookiesOptions)
      .json({ user: CreatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User does not exist" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const LogedInUser = await User.findById(user._id).select("-password");
    const token = LogedInUser.generateToken();
    if (!token) {
      return res.status(500).json({ message: "Token generation failed" });
    }

    res
      .status(200)
      .cookie("token", token, cookiesOptions)
      .json({ user: LogedInUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const logout = (req, res) => {
  res
    .status(200)
    .cookie("token", "", {
      ...cookiesOptions,
      maxAge: 0,
    })
    .json({ message: "Logged out successfully" });
};

export const getMe = async (req, res) => {
  try {
    if (req.user) res.status(200).json({ user: req.user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
