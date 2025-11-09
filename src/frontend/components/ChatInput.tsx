import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Send } from "lucide-react";
import { Button } from "./ui/button";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onFocusChange: (focused: boolean) => void;
  showSuggestions: boolean;
}

export function ChatInput({
  onSendMessage,
  onFocusChange,
  showSuggestions,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = () => {
    setIsFocused(true);
    onFocusChange(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onFocusChange(false);
  };

  const handleSubmit = () => {
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (value: string) => {
    onSendMessage(value);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="shrink-0 bg-[#f5f3ef]/90 backdrop-blur-md border-t border-[#d4cfbe]/30 px-4 md:px-8 py-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* Suggestions */}
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 mb-4"
          >
            <Button
              onClick={() => handleSuggestionClick("Yes")}
              variant="outline"
              className="bg-[#e8e4d9]/50 border-[#d4cfbe]/50 text-[#8b8475] hover:bg-[#8b8475] hover:text-[#f5f3ef] transition-all duration-300"
            >
              Yes
            </Button>
            <Button
              onClick={() => handleSuggestionClick("No")}
              variant="outline"
              className="bg-[#e8e4d9]/50 border-[#d4cfbe]/50 text-[#8b8475] hover:bg-[#8b8475] hover:text-[#f5f3ef] transition-all duration-300"
            >
              No
            </Button>
          </motion.div>
        )}

        {/* Input */}
        <motion.div
          animate={{
            scale: isFocused ? 1.02 : 1,
          }}
          transition={{ duration: 0.3 }}
          className="flex items-end gap-3 bg-white/60 rounded-2xl px-4 py-3 border border-[#d4cfbe]/40 shadow-sm"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-[#6b6558] placeholder:text-[#a8a195] max-h-32"
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="shrink-0 bg-[#8b8475] hover:bg-[#6b6558] text-[#f5f3ef] rounded-xl h-10 w-10 p-0 transition-all duration-300 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
