import { Avatar, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface UserAvatarProps {
  name: string;
  size?: number;
}

const UserAvatar = ({ name, size = 40 }: UserAvatarProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { handleLogout } = useAuth();
  const navigate = useNavigate();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogoutClick = () => {
    handleLogout();
    handleClose();
  };

  const handleProfileClick = () => {
    navigate("/home");
    handleClose();
  };

  return (
    <>
      <Avatar
        onClick={handleClick}
        sx={{
          bgcolor: "orange",
          width: size,
          height: size,
          cursor: "pointer",
          "&:hover": {
            opacity: 0.8,
          },
        }}
      >
        {name.charAt(0).toUpperCase()}
      </Avatar>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            mt: 1.5,
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
          },
        }}
      >
        <MenuItem onClick={handleProfileClick}>Profile</MenuItem>
        <MenuItem onClick={handleLogoutClick}>Logout</MenuItem>
      </Menu>
    </>
  );
};

export default UserAvatar;
