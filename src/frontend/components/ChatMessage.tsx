import { motion } from "motion/react";

interface Message {
  id: string;
  text: string;
  isAi: boolean;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  isOtherHovered: boolean;
}

export function ChatMessage({
  message,
  isHovered,
  onHover,
  isOtherHovered,
}: ChatMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: isOtherHovered ? 0.4 : 1,
        y: 0,
        scale: isHovered ? 1.02 : 1,
      }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onMouseEnter={() => onHover(message.id)}
      onMouseLeave={() => onHover(null)}
      className={`flex ${message.isAi ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-6 py-4 ${
          message.isAi
            ? "bg-[#e8e4d9]/60 text-[#6b6558] border border-[#d4cfbe]/40"
            : "bg-[#8b8475] text-[#f5f3ef]"
        } shadow-sm transition-all duration-300 ${
          isHovered ? "shadow-md" : ""
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
      </div>
    </motion.div>
  );
}
