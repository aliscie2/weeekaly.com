import { motion } from "motion/react";
import { PageHelmet } from "../components/PageHelmet";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { DemoSection } from "../components/DemoSection";
import logo from "../public/logo.png";
import { toast } from "sonner";

interface LandingPageProps {
  onLogin: () => Promise<boolean>;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  const handleLogin = async () => {
    const success = await onLogin();
    if (!success) {
      toast.error("Login failed. Please try again.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHelmet
        title="Weekaly - Your AI Personal Secretary for Calendar Management"
        description="Not just a calendar, it's your AI personal secretary. Sync with Google Calendar, share availability, and coordinate meetings across time zones effortlessly."
      />
      <div className="min-h-screen flex flex-col items-center px-4 py-8 md:py-16">
        <div className="w-full max-w-2xl mx-auto space-y-8 md:space-y-12">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="flex justify-center pt-8"
          >
            <img
              src={logo}
              alt="Logo"
              className="w-20 h-20 md:w-32 md:h-32 object-contain"
            />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-3xl md:text-5xl text-[#8b8475] leading-relaxed text-center"
          >
            Not just a calendar,
            <br />
            it's your AI personal secretary
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base md:text-xl text-[#a8a195] max-w-xl mx-auto leading-relaxed text-center px-4"
          >
            No need to negotiate your time zone. Your friend lives in Alaska,
            you live in China? Totally fine, we can figure it out.
          </motion.p>

          {/* Login Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex justify-center"
          >
            <Button
              onClick={handleLogin}
              className="bg-[#8b8475] hover:bg-[#6b6558] text-[#f5f3ef] px-6 py-5 md:px-8 md:py-6 text-base md:text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <svg
                className="w-4 h-4 md:w-5 md:h-5 mr-2 md:mr-3"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Login now
            </Button>
          </motion.div>

          {/* Demo Section */}
          <DemoSection />

          {/* Footer */}
          <motion.footer
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12 md:mt-20 pb-8 text-center"
          >
            <div className="space-y-4">
              {/* Social Media Links */}
              <div className="flex justify-center items-center gap-4 md:gap-6 flex-wrap">
                <a
                  href="https://x.com/odoc_ic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                >
                  X (Twitter)
                </a>
                <a
                  href="https://t.me/odoc_ic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                >
                  Telegram
                </a>
                <a
                  href="https://discord.gg/HbaFQXDD"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                >
                  Discord
                </a>
                <a
                  href="https://www.youtube.com/@odoc_ic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                >
                  YouTube
                </a>
                <a
                  href="https://www.instagram.com/odoc_ic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                >
                  Instagram
                </a>
                <a
                  href="https://www.tiktok.com/@odoc.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                >
                  TikTok
                </a>
                <a
                  href="https://www.linkedin.com/company/odocic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors text-sm"
                >
                  LinkedIn
                </a>
              </div>

              {/* Legal Links */}
              <div className="flex justify-center items-center gap-4 text-sm">
                <Link
                  to="/privacy"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors"
                >
                  Privacy Policy
                </Link>
                <span className="text-[#a8a195]">•</span>
                <Link
                  to="/terms"
                  className="text-[#a8a195] hover:text-[#8b8475] transition-colors"
                >
                  Terms of Service
                </Link>
              </div>

              {/* Made by ODOC.APP */}
              <p className="text-[#a8a195] text-sm">
                Made with ❤️ by{" "}
                <a
                  href="https://odoc.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8b8475] hover:underline"
                >
                  ODOC.APP
                </a>{" "}
                team
              </p>
            </div>
          </motion.footer>
        </div>
      </div>
    </div>
  );
}
