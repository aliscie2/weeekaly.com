import { useState, useEffect } from "react";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../declarations/backend";

const App = () => {
  const [greeting, setGreeting] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const canisterId = import.meta.env.VITE_BACKEND_CANISTER_ID;
  const host = import.meta.env.VITE_IC_HOST || "http://localhost:4943";

  const agent = new HttpAgent({ host });

  // Only fetch root key in development
  if (import.meta.env.VITE_DFX_NETWORK !== "ic") {
    agent.fetchRootKey().catch(console.error);
  }

  const actor = Actor.createActor(idlFactory, {
    agent,
    canisterId,
  });

  const handleHelloWorld = async () => {
    setLoading(true);
    try {
      const result = await actor.hello_world();
      setGreeting(result as string);
    } catch (error) {
      console.error("Error calling hello_world:", error);
      setGreeting("Error: Could not connect to backend");
    } finally {
      setLoading(false);
    }
  };

  const handleGreet = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const result = await actor.greet(name);
      setGreeting(result as string);
    } catch (error) {
      console.error("Error calling greet:", error);
      setGreeting("Error: Could not connect to backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleHelloWorld();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Welcome to oDoc
          </h1>
          <p className="text-gray-600">
            AI Job Matching & Crypto Payments Platform
          </p>
        </div>

        <div className="space-y-6">
          {/* Greeting Display */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-6 text-white">
            <p className="text-lg font-medium">
              {loading ? "Loading..." : greeting || "Connecting to backend..."}
            </p>
          </div>

          {/* Hello World Button */}
          <button
            onClick={handleHelloWorld}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 active:scale-95"
          >
            Say Hello World
          </button>

          {/* Greet Form */}
          <div className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              onKeyPress={(e) => e.key === "Enter" && handleGreet()}
            />
            <button
              onClick={handleGreet}
              disabled={loading || !name.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 active:scale-95"
            >
              Greet Me
            </button>
          </div>

          {/* Info Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-3">
              🚀 Getting Started
            </h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">✓</span>
                <span>Backend is running on Internet Computer</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">✓</span>
                <span>Frontend built with React + Tailwind CSS</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-500 mr-2">✓</span>
                <span>Ready to build your features!</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
