import { useEffect } from "react";

interface PageHelmetProps {
  title: string;
  description?: string;
}

export function PageHelmet({ title, description }: PageHelmetProps) {
  const fullTitle = title.includes("Weekaly") ? title : `${title} - Weekaly`;

  useEffect(() => {
    document.title = fullTitle;

    if (description) {
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement("meta");
        metaDescription.setAttribute("name", "description");
        document.head.appendChild(metaDescription);
      }
      metaDescription.setAttribute("content", description);
    }
  }, [fullTitle, description]);

  return null;
}
