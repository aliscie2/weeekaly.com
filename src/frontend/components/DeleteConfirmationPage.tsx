import { motion } from "motion/react";
import { Button } from "./ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";

interface DeleteConfirmationPageProps {
  itemName: string;
  itemType: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmationPage({
  itemName,
  itemType,
  onConfirm,
  onCancel,
}: DeleteConfirmationPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-y-auto py-8 md:py-12 px-4 md:px-8"
    >
      <div className="max-w-2xl mx-auto">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-4"
        >
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-[#8b8475] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60 -ml-2 group"
          >
            <ArrowLeft className="h-4 w-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back
          </Button>
        </motion.div>

        {/* Confirmation Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-white/60 border border-red-200 rounded-3xl p-8 md:p-12 shadow-lg text-center"
        >
          {/* Warning Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
            className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6"
          >
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="text-2xl md:text-3xl text-[#8b8475] mb-4"
          >
            Delete {itemType}?
          </motion.h2>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="text-[#a8a195] mb-2"
          >
            Are you sure you want to delete
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="text-[#8b8475] mb-8"
          >
            "{itemName}"
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="text-sm text-red-600 mb-8"
          >
            This action cannot be undone.
          </motion.p>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={onCancel}
              variant="outline"
              className="bg-[#e8e4d9]/60 hover:bg-[#d4cfbe] text-[#8b8475] border-[#d4cfbe]/40 px-8"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="bg-red-500 hover:bg-red-600 text-white px-8"
            >
              Delete {itemType}
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
