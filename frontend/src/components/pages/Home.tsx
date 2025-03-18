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

const generateRandomRoomId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const HomeComponent = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showError, setShowError] = useState<boolean>(false);

  useEffect(() => {
    // Load username from localStorage if available
    const savedUsername = localStorage.getItem("username");
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleCreateRoom = () => {
    if (!username.trim()) {
      setError("Please enter your name");
      setShowError(true);
      return;
    }

    // Save username to localStorage
    localStorage.setItem("username", username);

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

    // Save username to localStorage
    localStorage.setItem("username", username);

    // Log before navigation
    console.log(`Joining room with ID: ${roomId}`);

    // Navigate to the room
    navigate(`/room/${roomId}`);
  };

  const handleCloseError = () => {
    setShowError(false);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4, textAlign: "center" }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Virtulink
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
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
  );
};

export default HomeComponent;
