import {
  register,
  login,
  logout,
  getMe,
} from "../controllers/users.controller.js";
import { verifyCookie } from "../middleware/auth.middleware.js";
import { Router } from "express";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// Protected routes
router.get("/me", verifyCookie, getMe);

export default router;
