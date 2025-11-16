import React from "react";
import { motion } from "motion/react";
import { User } from "lucide-react";
import logo from "../public/logo.png";

interface DayAvailability {
  dayName: string;
  available: boolean;
}

const demoAvailability: DayAvailability[] = [
  { dayName: "Mon", available: true },
  { dayName: "Tue", available: true },
  { dayName: "Wed", available: true },
  { dayName: "Thu", available: true },
  { dayName: "Fri", available: false },
  { dayName: "Sat", available: true },
  { dayName: "Sun", available: true },
];

export function DemoSection() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="w-full max-w-3xl mx-auto mt-8 md:mt-16 mb-8"
    >
      {/* Demo Container */}
      <div className="bg-white/40 backdrop-blur-sm border border-[#d4cfbe]/30 rounded-2xl md:rounded-3xl p-4 md:p-8 shadow-xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mb-4 md:mb-6"
        >
          <h3 className="text-lg md:text-2xl text-[#8b8475] mb-1 md:mb-2">
            See it in action
          </h3>
          <p className="text-xs md:text-sm text-[#a8a195]">
            Watch how our AI finds the perfect meeting time
          </p>
        </motion.div>

        <div className="space-y-3 md:space-y-4">
          {/* User Message 1 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex gap-2 md:gap-3 justify-end"
          >
            <div className="bg-[#8b8475]/10 border border-[#d4cfbe]/40 rounded-xl md:rounded-2xl rounded-tr-sm px-3 md:px-4 py-2 md:py-3 max-w-[85%] md:max-w-[80%]">
              <p className="text-xs md:text-sm text-[#8b8475]">
                I am availabile every day from 9 AM to 6 PM except Fridays
              </p>
            </div>
            <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#8b8475]/20 flex items-center justify-center">
              <User className="h-3 w-3 md:h-4 md:w-4 text-[#8b8475]" />
            </div>
          </motion.div>

          {/* AI Response 1 with Calendar Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex gap-2 md:gap-3"
          >
            <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#8b8475] flex items-center justify-center p-1.5">
              <img
                src={logo}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="bg-white/60 border border-[#d4cfbe]/40 rounded-xl md:rounded-2xl rounded-tl-sm py-2 md:py-3 max-w-[90%] md:max-w-[85%]">
              <p className="text-xs md:text-sm text-[#8b8475] mb-2 md:mb-3 px-3 md:px-4">
                Got it! Here's your weekly availability:
              </p>

              {/* Availability Card */}
              <div className="bg-[#f5f3ef]/50 border border-[#d4cfbe]/30 rounded-lg md:rounded-xl">
                <div className="flex justify-between">
                  {demoAvailability.map((day, index) => (
                    <React.Fragment key={day.dayName}>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        viewport={{ once: true, margin: "-50px" }}
                        transition={{
                          duration: 0.4,
                          delay: 0.5 + index * 0.05,
                        }}
                        className="flex flex-col items-center gap-0.5 flex-1"
                      >
                        <span className="text-[8px] md:text-[10px] text-[#a8a195]">
                          {day.dayName}
                        </span>
                        <motion.div
                          whileInView={
                            day.available
                              ? {
                                  scale: [1, 1.05, 1],
                                  boxShadow: [
                                    "0 2px 4px rgba(34, 197, 94, 0.2)",
                                    "0 4px 12px rgba(34, 197, 94, 0.4)",
                                    "0 2px 4px rgba(34, 197, 94, 0.2)",
                                  ],
                                }
                              : {}
                          }
                          viewport={{ once: true }}
                          transition={{
                            duration: 2,
                            delay: 1,
                            repeat: Infinity,
                            repeatDelay: 3,
                          }}
                          className={`w-full h-12 md:h-16 ${
                            day.available
                              ? "bg-green-500/70"
                              : "bg-[#e8e4d9]/50"
                          }`}
                        >
                          {day.available && (
                            <div className="h-full flex items-center justify-center">
                              <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{
                                  duration: 0.3,
                                  delay: 0.6 + index * 0.05,
                                }}
                                className="text-[7px] md:text-[8px] text-white text-center leading-tight"
                              >
                                9AM
                                <br />-<br />
                                6PM
                              </motion.div>
                            </div>
                          )}
                        </motion.div>
                      </motion.div>
                      {index < demoAvailability.length - 1 && (
                        <div className="w-px bg-[#d4cfbe]/30 self-stretch" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* User Message 2 */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex gap-2 md:gap-3 justify-end"
          >
            <div className="bg-[#8b8475]/10 border border-[#d4cfbe]/40 rounded-xl md:rounded-2xl rounded-tr-sm px-3 md:px-4 py-2 md:py-3 max-w-[85%] md:max-w-[80%]">
              <p className="text-xs md:text-sm text-[#8b8475]">
                Alex live in USA 🇺🇸, Madae live in Bali 🇮🇩, and I live Dubai 🇦🇪
                for all our timezones, which is the best time to meet?
              </p>
            </div>
            <div className="shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#8b8475]/20 flex items-center justify-center">
              <User className="h-3 w-3 md:h-4 md:w-4 text-[#8b8475]" />
            </div>
          </motion.div>

          {/* AI Response 2 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="flex gap-2 md:gap-3"
          >
            <div className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#8b8475] flex items-center justify-center p-1.5">
              <img
                src={logo}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="bg-white/60 border border-[#d4cfbe]/40 rounded-xl md:rounded-2xl rounded-tl-sm px-3 md:px-4 py-2 md:py-3 max-w-[90%] md:max-w-[85%]">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.8 }}
              >
                <p className="text-xs md:text-sm text-[#8b8475] mb-2">
                  Perfect! I've analyzed everyone's availability across time
                  zones.
                </p>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                  className="bg-green-500/20 border border-green-600/30 rounded-lg md:rounded-xl px-3 md:px-4 py-2 md:py-3 mt-2"
                >
                  <motion.p
                    whileInView={{
                      scale: [1, 1.02, 1],
                    }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 1.5,
                      delay: 1.2,
                      repeat: Infinity,
                      repeatDelay: 3,
                    }}
                    className="text-xs md:text-sm text-green-700"
                  >
                    ✨ Best time: Tomorrow evening at 5:00 PM
                  </motion.p>
                  <p className="text-[10px] md:text-xs text-green-600/80 mt-1">
                    Works for all 3 of you.
                  </p>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
