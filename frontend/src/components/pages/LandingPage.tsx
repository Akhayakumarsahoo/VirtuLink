import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import UserAvatar from "../common/UserAvatar";

const LandingPage = () => {
  const router = useNavigate();
<<<<<<< HEAD
  const authContext = useAuth();
  if (!authContext) {
    throw new Error("authContext must be used within an AuthProvider");
  }

  const { userData } = authContext;
=======
  const { userData } = useAuth();
>>>>>>> 058fb48f7ed5c5896619190b66efba830ff9e226

  return (
    <>
      <div
        className="pageContainer h-screen w-screen "
        style={{
          background: "url(background.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <nav className="flex justify-between pt-5">
          <div className="Logo pl-5">
            <h1 className="text-white text-4xl font-medium">VirtuLink</h1>
          </div>
          <div className="Auth text-white text-xl space-x-5 pr-5 font-medium flex items-center">
            {userData?.isAuthenticated ? (
              <>
                <button
                  className="bg-orange-500 rounded h-10 w-32 hover:cursor-pointer"
                  onClick={() => router("/home")}
                >
                  Dashboard
                </button>
                <UserAvatar name={userData.name} />
              </>
            ) : (
              <>
                <button
                  className="hover:cursor-pointer"
                  onClick={() => router("/home")}
                >
                  Join as Guest
                </button>
                <button
                  className="bg-orange-500 rounded h-10 w-32 hover:cursor-pointer text-sm"
                  onClick={() => router("/auth")}
                >
                  SignUp/LogIn
                </button>
              </>
            )}
          </div>
        </nav>

        <div className="Main-container flex flex-col md:flex-row h-[80vh] pt-10">
          <div className="h-full flex flex-col justify-center w-1/2 pl-10 space-y-10">
            <h1 className="text-white text-6xl font-bold">
              <span className="text-orange-500">Connect</span> with your Loved
              Ones
            </h1>
            <h5 className="text-gray-500 text-xl font-medium">
              Cover a distance with VirtuLink
            </h5>
            {!userData?.isAuthenticated && (
              <Link
                to={"/auth"}
                className="bg-orange-500 h-10 w-32 rounded text-white font-medium flex items-center justify-center"
              >
                Get Started
              </Link>
            )}
          </div>
          <div className="Image flex justify-center items-center w-1/2">
            <img src="mobile.png" alt="mobileImage" className="h-[100%]" />
          </div>
        </div>
      </div>
    </>
  );
};

export default LandingPage;
