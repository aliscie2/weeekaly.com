import { useNavigate } from "react-router-dom";
import { PageHelmet } from "../components/PageHelmet";
import { motion } from "motion/react";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";

export function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9]">
      <PageHelmet
        title="Terms of Service"
        description="Read Weekaly's Terms of Service to understand your rights and responsibilities when using our calendar application."
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="min-h-screen px-4 py-8 md:py-12"
      >
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => navigate("/")}
            variant="ghost"
            className="mb-6 text-[#8b8475] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60 -ml-2 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Home
          </Button>

          <div className="bg-white/60 border border-[#d4cfbe]/40 rounded-3xl p-6 md:p-12 shadow-lg">
            <article className="prose prose-gray max-w-none">
              <div className="border-b border-[#e8e4d9] pb-6 mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-[#8b8475] mb-2">
                  Terms of Service
                </h1>
                <p className="text-sm text-[#a8a195]">
                  Last Updated: November 16, 2025
                </p>
              </div>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Agreement to Terms
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  By accessing or using Weekaly ("the Service"), you agree to be
                  bound by these Terms of Service ("Terms"). If you do not agree
                  to these Terms, you may not access or use the Service.
                </p>
              </section>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Description of Service
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  Weekaly is a calendar and scheduling application built on the
                  Internet Computer Protocol that integrates with Google
                  Calendar. The Service enables users to:
                </p>
                <ul className="space-y-2 ml-6 list-disc text-[#6b6558]">
                  <li className="leading-relaxed">
                    Manage personal availability schedules
                  </li>
                  <li className="leading-relaxed">
                    Synchronize with Google Calendar
                  </li>
                  <li className="leading-relaxed">
                    Share availability with other users
                  </li>
                  <li className="leading-relaxed">
                    Create and manage calendar events
                  </li>
                  <li className="leading-relaxed">
                    Coordinate meetings and gatherings
                  </li>
                </ul>
              </section>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Contact Information
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  If you have any questions about these Terms of Service, please
                  contact us at:
                </p>
                <p className="text-[#6b6558]">
                  Email:{" "}
                  <a
                    href="http://x.com/odoc_ic"
                    className="text-[#8b8475] hover:underline"
                  >
                    http://x.com/odoc_ic
                  </a>
                </p>
              </section>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Acknowledgment
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  By using Weekaly, you acknowledge that you have read,
                  understood, and agree to be bound by these Terms of Service.
                </p>
              </section>
            </article>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
