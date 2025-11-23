import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { PageHelmet } from "../components/PageHelmet";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { ArrowLeft, ZoomIn, ZoomOut } from "lucide-react";
import Cropper from "react-easy-crop";

interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CroppedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AvatarEditPageProps {
  imageSrc: string;
  onSave: (croppedAreaPixels: CroppedAreaPixels) => void;
}

export function AvatarEditPage({ imageSrc, onSave }: AvatarEditPageProps) {
  const navigate = useNavigate();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedAreaPixels | null>(null);

  const onCropComplete = (
    _croppedArea: CroppedArea,
    croppedAreaPixels: CroppedAreaPixels,
  ) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSave = () => {
    if (croppedAreaPixels) {
      onSave(croppedAreaPixels);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-y-auto py-8 md:py-12 px-4 md:px-8"
    >
      <PageHelmet title="Edit Avatar" />
      <div className="max-w-4xl mx-auto px-2 md:px-0">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-2 md:mb-4"
        >
          <Button
            variant="ghost"
            onClick={() => navigate("/profile")}
            className="text-[#8b8475] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60 -ml-2 group h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm"
          >
            <ArrowLeft className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 transition-transform group-hover:-translate-x-1" />
            Back
          </Button>
        </motion.div>

        {/* Crop Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="bg-white/60 border border-[#d4cfbe]/40 rounded-2xl md:rounded-3xl p-3 md:p-8 shadow-lg"
        >
          <h2 className="text-[#8b8475] mb-3 md:mb-6">Crop & Zoom Avatar</h2>

          {/* Cropper Area */}
          <div className="relative h-[280px] sm:h-[350px] md:h-[500px] bg-[#e8e4d9]/30 rounded-lg md:rounded-xl overflow-hidden mb-3 md:mb-6">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Zoom Slider */}
          <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-6">
            <div className="flex items-center justify-between">
              <Label className="text-[#8b8475] flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                <ZoomOut className="h-3 w-3 md:h-4 md:w-4" />
                Zoom
              </Label>
              <ZoomIn className="h-3 w-3 md:h-4 md:w-4 text-[#8b8475]" />
            </div>
            <Slider
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 md:gap-3">
            <Button
              onClick={() => navigate("/profile")}
              variant="outline"
              className="bg-[#e8e4d9]/60 hover:bg-[#d4cfbe] text-[#8b8475] border-[#d4cfbe]/40 h-8 md:h-10 px-3 md:px-4 text-xs md:text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#8b8475] hover:bg-[#6b6558] text-[#f5f3ef] h-8 md:h-10 px-3 md:px-4 text-xs md:text-sm"
            >
              Save Avatar
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
