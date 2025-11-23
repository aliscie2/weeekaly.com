import { useNavigate } from "react-router-dom";
import { PageHelmet } from "../components/PageHelmet";
import { motion } from "motion/react";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";

export function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#f5f3ef] via-[#ebe8e0] to-[#e8e4d9]">
      <PageHelmet
        title="Privacy Policy"
        description="Learn how Weekaly protects your privacy and handles your calendar data. Built on Internet Computer Protocol for security."
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
                  Privacy Policy
                </h1>
                <p className="text-sm text-[#a8a195]">
                  Last Updated: November 16, 2025
                </p>
              </div>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Introduction
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  Weekaly ("we," "our," or "us") is committed to protecting your
                  privacy. This Privacy Policy explains how we collect, use, and
                  safeguard your information when you use our calendar and
                  scheduling application built on the Internet Computer
                  Protocol.
                </p>
              </section>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Information We Collect
                </h2>

                <h3 className="text-xl font-medium text-[#8b8475]">
                  Personal Information
                </h3>
                <p className="text-[#6b6558] leading-relaxed">
                  When you use Weekaly, we collect and store the following data:
                </p>
                <ul className="space-y-2 ml-6 list-disc text-[#6b6558]">
                  <li className="leading-relaxed">
                    <strong>Email Address:</strong> Your email address is
                    collected during Google OAuth authentication and stored in
                    our backend canister for account identification and
                    communication purposes.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Name:</strong> Your name from your Google account is
                    stored to personalize your experience.
                  </li>
                  <li className="leading-relaxed">
                    <strong>User ID:</strong> A unique identifier from your
                    Google account (OAuth sub claim) used for authentication and
                    session management.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Profile Picture:</strong> Your Google profile
                    picture URL for display purposes.
                  </li>
                </ul>

                <h3 className="text-xl font-medium text-[#8b8475] pt-4">
                  Calendar Data
                </h3>
                <ul className="space-y-2 ml-6 list-disc text-[#6b6558]">
                  <li className="leading-relaxed">
                    <strong>Google Calendar Access:</strong> We request access
                    to your Google Calendar to synchronize events and
                    availability. We store OAuth access tokens and refresh
                    tokens securely in our backend canister.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Event Information:</strong> We fetch and temporarily
                    process your calendar events to determine busy times.
                    However, we only store the start and end times of events
                    (busy time blocks), not the event titles, descriptions, or
                    other details.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Availability Slots:</strong> Your manually created
                    availability slots are stored in our backend to enable
                    scheduling features.
                  </li>
                </ul>
              </section>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  How We Use Your Information
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  We use the collected information for the following purposes:
                </p>
                <ul className="space-y-2 ml-6 list-disc text-[#6b6558]">
                  <li className="leading-relaxed">
                    <strong>Authentication:</strong> To verify your identity and
                    maintain secure sessions using Google OAuth.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Calendar Synchronization:</strong> To fetch your
                    Google Calendar events and display your availability to
                    others.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Scheduling:</strong> To enable you to share your
                    availability and coordinate meetings with other users.
                  </li>
                  <li className="leading-relaxed">
                    <strong>Communication:</strong> To send you service-related
                    notifications and updates via email.
                  </li>
                </ul>
              </section>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Data Security
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  <strong>Important Notice:</strong> We currently do not encrypt
                  user data at rest in our backend storage. While the Internet
                  Computer Protocol provides security guarantees, your data is
                  stored in plaintext within our canisters. Future versions of
                  Weekaly will implement end-to-end encryption to provide
                  additional privacy protection.
                </p>
              </section>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Contact Us
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  If you have any questions about this Privacy Policy or our
                  data practices, please contact us at:
                </p>
                <p className="text-[#6b6558]">
                  Email:{" "}
                  <a
                    href="mailto:privacy@odoc.app"
                    className="text-[#8b8475] hover:underline"
                  >
                    privacy@odoc.app
                  </a>
                </p>
              </section>

              <section className="space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-[#8b8475]">
                  Google API Services User Data Policy
                </h2>
                <p className="text-[#6b6558] leading-relaxed">
                  Weekaly's use and transfer of information received from Google
                  APIs adheres to the{" "}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#8b8475] hover:underline"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including the Limited Use requirements.
                </p>
              </section>
            </article>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
