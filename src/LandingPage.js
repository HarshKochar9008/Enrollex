import React, { useState } from "react";
import { Moon, Sun, MessageCircle, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const [darkMode, setDarkMode] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      className={`relative overflow-hidden min-h-screen ${
        darkMode
          ? "bg-gray-900 text-white"
          : "bg-gradient-to-br from-blue-100 via-white to-purple-100 text-gray-800"
      } flex flex-col transition duration-500`}
    >
      <>
        <div
          className={`absolute top-[-100px] left-[-100px] w-[400px] h-[400px] ${
            darkMode ? "bg-purple-800 blob-glow" : "bg-purple-300"
          } rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob`}
        ></div>
        <div
          className={`absolute top-[-50px] right-[-100px] w-[300px] h-[300px] ${
            darkMode ? "bg-blue-800 blob-glow" : "bg-blue-300"
          } rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000`}
        ></div>
        <div
          className={`absolute bottom-[-100px] left-1/2 w-[400px] h-[400px] ${
            darkMode ? "bg-pink-800 blob-glow" : "bg-pink-300"
          } rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000`}
        ></div>
      </>

      <nav className="z-50 fixed top-0 left-0 w-full flex justify-between items-center px-6 py-4 backdrop-blur-lg dark:bg-gray-900/80 shadow-sm transition-all">

        <div className="flex items-center gap-3">
          <img src="/Enrollex.png" alt="Enrollex Logo" className="h-10 w-9" />
          <h1 className="text-xl  font-bold text-blue-700 dark:text-blue-200">
            Enrollex
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
            aria-label="Toggle Dark Mode"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section
  id="hero"
  className="z-10 flex-1 flex flex-col justify-center items-center text-center px-4 min-h-[calc(100vh-64px)] mt-[64px] relative"
>
        <div className="flex flex-col items-center justify-center  w-full h-full">
          <h2 className="text-4xl md:text-5xl font-semibold mb-4 dark:text-white">
            Streamline College Administration
          </h2>
          <p className="text-gray-600 dark:text-gray-200 text-lg md:text-xl max-w-xl mb-8">
            Enrollex helps your college manage registrations, departments, documents, and ID cards—all in one secure platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate("/register")}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl text-lg hover:bg-blue-700 transition"
            >
              Student Register
            </button>
            <button
              onClick={() => navigate("/admin/login")}
              className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-6 py-3 rounded-xl text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Admin Login
            </button>
          </div>
        </div>

       {/* Scroll Down Arrow Button - absolutely positioned at bottom center of hero section */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex flex-col items-center justify-center z-10">
          <button
            onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
            className="animate-bounce rounded-full border-2 border-blue-300 dark:border-blue-500 bg-white/80 dark:bg-gray-900/80 shadow-md text-4xl text-blue-600 dark:text-blue-400 focus:outline-none mb-2 w-12 h-12 flex items-center justify-center transition hover:bg-blue-50 dark:hover:bg-blue-800"
            aria-label="Scroll to Features"
            style={{ boxShadow: "0 4px 24px 0 rgba(59,130,246,0.10)" }}
          >
            <ArrowDown size={24} />
          </button>
        </div>
      </section>

      {/* Divider Line between Hero and Features */}
      <div className="w-full flex justify-center items-center">
        <div className="h-0.5 w-24 bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 opacity-60 rounded-full"></div>
      </div>

      {/* Features Section */}
      <section id="features" className="z-10 relative flex flex-col items-center justify-center py-20 px-4 min-h-[60vh]">
        {/* Gradient Blobs Background */}
        <div className="absolute -top-24 -left-32 w-96 h-96 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 dark:from-blue-900 dark:via-purple-900 dark:to-pink-900 rounded-full filter blur-3xl opacity-50 animate-blob z-0"></div>
        <div className="absolute -bottom-20 right-0 w-80 h-80 bg-gradient-to-tr from-pink-300 via-purple-200 to-blue-200 dark:from-pink-900 dark:via-purple-900 dark:to-blue-900 rounded-full filter blur-3xl opacity-40 animate-blob animation-delay-2000 z-0"></div>
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-gradient-to-tl from-purple-200 via-blue-100 to-pink-100 dark:from-purple-900 dark:via-blue-900 dark:to-pink-900 rounded-full filter blur-2xl opacity-30 animate-blob animation-delay-4000 z-0"></div>
        <div className="max-w-4xl w-full mx-auto text-center relative z-10">
          <h3 className="text-2xl md:text-3xl font-bold mb-2 dark:text-white">Key Features</h3>
          <p className="text-gray-600 dark:text-gray-200 mb-8">Everything you need to manage your campus seamlessly.</p>
          <div className="flex flex-col md:flex-row gap-6 justify-center">
            <div className="flex-1 bg-white/80 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-md dark:shadow-xl p-6 text-left border border-gray-200 dark:border-gray-700 transition-colors">
              <h4 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">Smart Registration</h4>
              <p className="text-gray-600 dark:text-gray-100 text-sm">Register students, staff, and admins with photo capture and department selection.</p>
            </div>
            <div className="flex-1 bg-white/80 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-md dark:shadow-xl p-6 text-left border border-gray-200 dark:border-gray-700 transition-colors">
              <h4 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">ID & Document Generator</h4>
              <p className="text-gray-600 dark:text-gray-100 text-sm">Generate ID cards, bonafide slips, and documents with QR codes in one click.</p>
            </div>
            <div className="flex-1 bg-white/80 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-md dark:shadow-xl p-6 text-left border border-gray-200 dark:border-gray-700 transition-colors">
              <h4 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-2">Department Control</h4>
              <p className="text-gray-600 dark:text-gray-100 text-sm">Let each department manage its own documents, circulars, and student records.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Divider Line between Features and Footer */}
      <div className="w-full flex justify-center items-center">
        <div className="h-0.5 w-24 bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 opacity-60 rounded-full"></div>
      </div>

      {/* Footer with Gradient and Blob */}
      <footer className="z-10 relative py-4 text-sm text-gray-700 dark:text-gray-200 w-full mt-auto overflow-hidden">
        {/* Gradient Blob Background */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 dark:from-blue-900 dark:via-purple-900 dark:to-pink-900 rounded-full filter blur-3xl opacity-40 animate-blob z-0"></div>
        <div className="absolute bottom-0 right-0 w-72 h-32 bg-gradient-to-tr from-pink-200 via-purple-100 to-blue-100 dark:from-pink-900 dark:via-purple-900 dark:to-blue-900 rounded-full filter blur-2xl opacity-30 animate-blob animation-delay-2000 z-0"></div>
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between px-4">
          <div className="flex flex-col md:flex-row items-center md:items-center w-full md:w-auto text-left md:text-left">
            <span className="font-semibold text-blue-700 dark:text-blue-300 text-base mr-2">Enrollex</span>
            <span className="text-xs">© {new Date().getFullYear()} All rights reserved.</span>
          </div>
          <div className="flex flex-col md:flex-row items-center md:items-center w-full md:w-auto text-right md:text-right mt-1 md:mt-0">
            <span>Contact: <a href="mailto:support@enrollex.com" className="underline text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-400">support@enrollex.com</a></span>
          </div>
        </div>
      </footer>


      <button
        className="z-50 fixed bottom-6 right-6 p-3 bg-blue-600 text-white rounded-full shadow-xl hover:bg-blue-700 transition"
        aria-label="Open Chat"
      >
        <MessageCircle size={24} />
      </button>
    </div>
  );
};

export default LandingPage; 