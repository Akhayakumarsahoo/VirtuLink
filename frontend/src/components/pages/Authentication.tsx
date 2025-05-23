import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Snackbar, CircularProgress } from "@mui/material";
import { useAuth } from "../contexts/AuthContext";

// TODO remove, this demo shouldn't need to reset the theme.
const defaultTheme = createTheme();

export default function Authentication() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [formState, setFormState] = useState<number>(0); // 0 for login, 1 for register
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const authContext = useAuth();

  if (!authContext) {
    throw new Error("authContext must be used within an AuthProvider");
  }

  const { handleRegister, handleLogin } = authContext;

  const handleAuth = async () => {
    try {
      setLoading(true);
      setError("");

      if (formState === 0) {
        // Login
        await handleLogin(email, password);
      } else if (formState === 1) {
        // Register
        await handleRegister(name, email, password);
        setMessage("Registration successful");
        setOpen(true);
        setFormState(0); // Switch back to login form after successful registration
        setEmail("");
        setPassword("");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      <Box sx={{ display: "flex", height: "100vh" }}>
        <CssBaseline />

        {/* Background image section (previously Grid xs={false} sm={4} md={7}) */}
        <Box
          sx={{
            display: { xs: "none", sm: "block" },
            width: { sm: "33.33%", md: "58.33%" },
            backgroundImage: "url(background.png)",
            backgroundRepeat: "no-repeat",
            backgroundColor: (t) =>
              t.palette.mode === "light"
                ? t.palette.grey[50]
                : t.palette.grey[900],
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Form section (previously Grid xs={12} sm={8} md={5}) */}
        <Box
          component={Paper}
          elevation={6}
          square
          sx={{
            width: { xs: "100%", sm: "66.67%", md: "41.67%" },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            sx={{
              my: 8,
              mx: 4,
              width: "100%",
              maxWidth: "450px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
              <LockOutlinedIcon />
            </Avatar>

            <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
              <Button
                variant={formState === 0 ? "contained" : "outlined"}
                onClick={() => setFormState(0)}
                disabled={loading}
              >
                Sign In
              </Button>
              <Button
                variant={formState === 1 ? "contained" : "outlined"}
                onClick={() => setFormState(1)}
                disabled={loading}
              >
                Sign Up
              </Button>
            </Stack>

            <Box component="form" noValidate sx={{ mt: 1, width: "100%" }}>
              {formState === 1 && (
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  id="name"
                  label="Full Name"
                  name="name"
                  value={name}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              )}

              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                value={email}
                autoFocus={formState === 0}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                id="password"
                disabled={loading}
              />

              {error && (
                <Box sx={{ color: "error.main", mt: 2, textAlign: "center" }}>
                  {error}
                </Box>
              )}

              <Button
                type="button"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                onClick={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : formState === 0 ? (
                  "Login"
                ) : (
                  "Register"
                )}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={open}
        autoHideDuration={4000}
        onClose={() => setOpen(false)}
        message={message}
      />
    </ThemeProvider>
  );
}
