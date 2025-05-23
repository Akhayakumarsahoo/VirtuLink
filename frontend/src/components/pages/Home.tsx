import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  TextField,
  Container,
  Typography,
  Box,
  Paper,
  Divider,
  Snackbar,
  Alert,
} from "@mui/material";
import { useAuth } from "../contexts/AuthContext";
import UserAvatar from "../common/UserAvatar";

const generateRandomRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const Home = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showError, setShowError] = useState<boolean>(false);

  const authContext = useAuth();
  if (!authContext) {
    throw new Error("authContext must be used within an AuthProvider");
  }
  const { userData } = authContext;

  useEffect(() => {
    if (userData) {
      setUsername(userData.name);
    }
  }, []);

  const handleCreateRoom = () => {
    if (!username.trim()) {
      setError("Please enter your name");
      setShowError(true);
      return;
    }

    // Generate a random room ID
    const newRoomId = generateRandomRoomId();

    // Navigate to the room
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = () => {
    if (!username.trim()) {
      setError("Please enter your name");
      setShowError(true);
      return;
    }

    if (!roomId.trim()) {
      setError("Please enter a room code");
      setShowError(true);
      return;
    }
    // Navigate to the room
    navigate(`/room/${roomId}`);
  };

  const handleCloseError = () => {
    setShowError(false);
  };

  return (
    <div
      className="h-screen w-screen bg-gray-900"
      style={{
        background: "url(background.png)",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    >
      <nav className="flex justify-between items-center p-5 bg-gray-800">
        <div onClick={() => navigate("/")} className="Logo cursor-pointer">
          <h1 className="text-white text-4xl font-medium">VirtuLink</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-white text-lg">
            Welcome, {userData ? userData.name : "Guest User"}
          </span>
          <UserAvatar name={userData?.name || ""} />
        </div>
      </nav>
      <Container maxWidth="lg">
        <Box sx={{ my: 4, textAlign: "center" }}>
          <Typography variant="h5" className="text-slate-300 ">
            High-quality video calls for everyone
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 4,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              flex: 1,
              p: 4,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="h5" component="h2" gutterBottom>
              Join a Meeting
            </Typography>

            <TextField
              fullWidth
              label="Your Name"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
            />

            <TextField
              fullWidth
              label="Room Code"
              variant="outlined"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              margin="normal"
            />

            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              onClick={handleJoinRoom}
            >
              Join Room
            </Button>
          </Paper>

          <Divider
            orientation="vertical"
            flexItem
            sx={{ display: { xs: "none", md: "block" } }}
          />
          <Divider sx={{ display: { xs: "block", md: "none" } }} />

          <Paper
            elevation={3}
            sx={{
              flex: 1,
              p: 4,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Typography variant="h5" component="h2" gutterBottom>
              Start a New Meeting
            </Typography>

            <TextField
              fullWidth
              label="Your Name"
              variant="outlined"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
            />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create a new room and share the code with others to join.
            </Typography>

            <Button
              variant="contained"
              color="secondary"
              size="large"
              fullWidth
              onClick={handleCreateRoom}
            >
              Create New Room
            </Button>
          </Paper>
        </Box>

        <Box sx={{ mt: 6, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            By using Virtulink, you agree to our Terms of Service and Privacy
            Policy.
          </Typography>
        </Box>

        <Snackbar
          open={showError}
          autoHideDuration={6000}
          onClose={handleCloseError}
        >
          <Alert
            onClose={handleCloseError}
            severity="error"
            sx={{ width: "100%" }}
          >
            {error}
          </Alert>
        </Snackbar>
      </Container>
    </div>
  );
};

export default Home;
