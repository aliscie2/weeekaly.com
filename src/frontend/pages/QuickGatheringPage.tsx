import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { ArrowLeft, Users, Clock, MapPin, Check, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Slider } from "../components/ui/slider";
import { Label } from "../components/ui/label";
import { ScrollArea } from "../components/ui/scroll-area";
import { Input } from "../components/ui/input";

interface Contact {
  id: string;
  name: string;
  email: string;
  avatar: string;
  distance?: number; // in km
  available?: boolean;
}

interface QuickGatheringPageProps {
  contacts: Contact[];
}

export function QuickGatheringPage({ contacts }: QuickGatheringPageProps) {
  const navigate = useNavigate();
  const [radius, setRadius] = useState<number>(5); // km
  const [duration, setDuration] = useState<string>("1"); // hours
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filter available contacts within radius
  const availableNearby = contacts.filter(
    (contact) => contact.available && (contact.distance || 0) <= radius,
  );

  const toggleContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex-1 overflow-y-auto py-4 md:py-8 px-4 md:px-8"
    >
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-4"
        >
          <Button
            variant="ghost"
            onClick={() => navigate("/events")}
            className="text-[#8b8475] hover:text-[#8b8475] hover:bg-[#e8e4d9]/60 -ml-2 group h-8 md:h-10 px-2 md:px-4 text-xs md:text-sm"
          >
            <ArrowLeft className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 transition-transform group-hover:-translate-x-1" />
            Back
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-4 md:mb-6"
        >
          <h1 className="text-[#8b8475] mb-2">Quick Gathering</h1>
          <p className="text-sm text-[#a8a195]">
            Find nearby available contacts for spontaneous meetups
          </p>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="bg-white/60 border border-[#d4cfbe]/40 rounded-2xl md:rounded-3xl p-4 md:p-6 mb-4 md:mb-6 shadow-lg"
        >
          <div className="space-y-4 md:space-y-6">
            {/* Availability Duration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[#8b8475] flex items-center gap-2 text-sm md:text-base">
                  <Clock className="h-4 w-4" />
                  I'm available for
                </Label>
                <span className="text-sm text-[#8b8475]">
                  {duration} {duration === "1" ? "hour" : "hours"}
                </span>
              </div>
              <Slider
                value={[parseInt(duration)]}
                onValueChange={(value) => setDuration(value[0].toString())}
                min={1}
                max={7}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#a8a195]">
                <span>1 hour</span>
                <span>7 hours</span>
              </div>
            </div>

            {/* Distance Radius */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[#8b8475] flex items-center gap-2 text-sm md:text-base">
                  <MapPin className="h-4 w-4" />
                  Distance Radius
                </Label>
                <span className="text-sm text-[#8b8475]">{radius} km</span>
              </div>
              <Slider
                value={[radius]}
                onValueChange={(value) => setRadius(value[0])}
                min={1}
                max={50}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-[#a8a195]">
                <span>1 km</span>
                <span>50 km</span>
              </div>
            </div>

            {/* Select from Contacts */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[#8b8475] flex items-center gap-2 text-sm md:text-base">
                  <Users className="h-4 w-4" />
                  Invite specific contacts
                </Label>
                {selectedContacts.length > 0 && (
                  <Badge className="bg-[#8b8475] text-[#f5f3ef] hover:bg-[#8b8475] text-xs">
                    {selectedContacts.length} selected
                  </Badge>
                )}
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a8a195]" />
                <Input
                  type="text"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#f5f3ef] border-[#d4cfbe]/40 text-[#8b8475] placeholder:text-[#a8a195] focus:border-[#8b8475] h-9 md:h-10"
                />
              </div>

              {/* Contacts List */}
              <ScrollArea className="h-48 border border-[#d4cfbe]/40 rounded-xl bg-[#f5f3ef]">
                <div className="p-2 space-y-1">
                  {contacts
                    .filter(
                      (contact) =>
                        contact.name
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        contact.email
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()),
                    )
                    .map((contact) => {
                      const isSelected = selectedContacts.includes(contact.id);
                      return (
                        <div
                          key={contact.id}
                          onClick={() => toggleContact(contact.id)}
                          className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                            isSelected
                              ? "bg-[#8b8475] hover:bg-[#6b6558] shadow-md scale-[1.02]"
                              : "hover:bg-[#e8e4d9]/60"
                          }`}
                        >
                          <div
                            className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-[#f5f3ef] border-[#f5f3ef]"
                                : "border-[#d4cfbe] bg-white"
                            }`}
                          >
                            {isSelected && (
                              <Check
                                className="h-3 w-3 text-[#8b8475]"
                                strokeWidth={3}
                              />
                            )}
                          </div>
                          <Avatar
                            className={`h-8 w-8 transition-all ${isSelected ? "ring-2 ring-[#f5f3ef]" : ""}`}
                          >
                            <AvatarImage src={contact.avatar} />
                            <AvatarFallback
                              className={`text-xs ${isSelected ? "bg-[#f5f3ef] text-[#8b8475]" : "bg-[#d4cfbe] text-[#8b8475]"}`}
                            >
                              {contact.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm truncate ${isSelected ? "text-[#f5f3ef]" : "text-[#8b8475]"}`}
                            >
                              {contact.name}
                            </p>
                            <p
                              className={`text-xs truncate ${isSelected ? "text-[#f5f3ef]/80" : "text-[#a8a195]"}`}
                            >
                              {contact.email}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            </div>
          </div>
        </motion.div>

        {/* Radar - Available Nearby */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="bg-white/60 border border-[#d4cfbe]/40 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-lg"
        >
          <h3 className="text-[#8b8475] mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Available Nearby ({availableNearby.length})
          </h3>

          {/* Radar Visual */}
          <div className="relative aspect-square mb-6 bg-[#e8e4d9]/30 rounded-full overflow-hidden max-w-md mx-auto">
            {/* Radar circles */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="absolute w-full h-full border-2 border-[#8b8475]/20 rounded-full"></div>
              <div className="absolute w-3/4 h-3/4 border-2 border-[#8b8475]/20 rounded-full"></div>
              <div className="absolute w-2/4 h-2/4 border-2 border-[#8b8475]/20 rounded-full"></div>
              <div className="absolute w-1/4 h-1/4 border-2 border-[#8b8475]/20 rounded-full"></div>

              {/* Center point (You) */}
              <div className="absolute w-4 h-4 bg-[#8b8475] rounded-full z-10 shadow-lg"></div>

              {/* Available contacts as dots */}
              {availableNearby.map((contact, idx) => {
                const angle = (idx / availableNearby.length) * 2 * Math.PI;
                const distance = ((contact.distance || 0) / radius) * 45; // percentage of radius
                const x = 50 + distance * Math.cos(angle);
                const y = 50 + distance * Math.sin(angle);

                return (
                  <div
                    key={contact.id}
                    className="absolute cursor-pointer hover:scale-125 transition-transform"
                    style={{
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    title={contact.name}
                  >
                    <Avatar className="w-8 h-8 border-2 border-white shadow-lg">
                      <AvatarImage src={contact.avatar} alt={contact.name} />
                      <AvatarFallback className="bg-[#8b8475] text-white text-xs">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                );
              })}
            </div>

            {/* Scanning animation */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-[#8b8475]/10 to-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: "center" }}
            />
          </div>

          {/* Available Contacts List */}
          <div className="space-y-2">
            {availableNearby.length === 0 ? (
              <p className="text-center text-[#a8a195] py-4 text-sm">
                No contacts available within {radius} km
              </p>
            ) : (
              availableNearby.map((contact) => (
                <motion.div
                  key={contact.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-[#e8e4d9]/40 rounded-xl hover:bg-[#e8e4d9]/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback className="bg-[#d4cfbe] text-[#8b8475]">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-[#8b8475]">{contact.name}</p>
                      <p className="text-xs text-[#a8a195]">
                        {contact.distance?.toFixed(1)} km away
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/20 text-xs">
                    Available
                  </Badge>
                </motion.div>
              ))
            )}
          </div>

          {/* Create Gathering Button */}
          <Button
            className="w-full mt-6 bg-[#8b8475] hover:bg-[#6b6558] text-[#f5f3ef] h-10 md:h-11"
            disabled={
              availableNearby.length === 0 && selectedContacts.length === 0
            }
          >
            Create Gathering ({availableNearby.length + selectedContacts.length}{" "}
            {availableNearby.length + selectedContacts.length === 1
              ? "person"
              : "people"}
            )
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
