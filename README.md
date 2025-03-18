# Virtulink

A high-quality video conferencing platform that facilitates seamless real-time communication through browser-based WebRTC technology.

![Virtulink Banner](https://via.placeholder.com/1200x300?text=Virtulink)

## Features

- **High-Quality Video Calls**: Experience crystal-clear video and audio communication
- **Room-Based Meetings**: Create or join virtual meeting rooms with unique IDs
- **Real-Time Interaction**: Connect instantly with multiple participants
- **Screen Sharing**: Share your screen for presentations and collaboration
- **User Timeline**: Track when participants join and leave meetings
- **Chat Functionality**: Text chat with meeting participants
- **Simple Interface**: User-friendly design for easy navigation

## Tech Stack

### Frontend

- React.js with TypeScript
- WebRTC for peer-to-peer connections
- Material UI for responsive design
- Vite for fast development and building

### Backend

- Node.js with Express
- Socket.IO for real-time event handling
- RESTful API architecture

## Getting Started

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm or yarn package manager
- A modern web browser (Chrome, Firefox, Safari, or Edge)

### Installation

1. Clone the repository

   ```bash
   git clone https://github.com/yourusername/virtulink.git
   cd virtulink
   ```

2. Backend Setup

   ```bash
   cd backend
   npm install
   npm start
   ```

3. Frontend Setup (in a new terminal)

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## Usage

### Creating a Meeting

1. Navigate to the homepage
2. Enter your name
3. Click "Create New Room"
4. Share the generated room code with participants

### Joining a Meeting

1. Navigate to the homepage
2. Enter your name and the room code
3. Click "Join Room"
4. Allow camera and microphone access when prompted

## Development

### Project Structure

```
virtulink/
├── backend/           # Server-side code
│   ├── src/           # Source files
│   ├── package.json   # Dependencies
│   └── ...
├── frontend/          # Client-side code
│   ├── src/           # Source files
│   ├── public/        # Static assets
│   ├── package.json   # Dependencies
│   └── ...
└── README.md          # This file
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- WebRTC community for the amazing technology
- All contributors who have helped shape this project
