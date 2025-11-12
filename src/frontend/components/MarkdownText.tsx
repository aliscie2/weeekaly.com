/**
 * Simple markdown renderer for chat messages
 * Supports: bold, lists, line breaks
 */

interface MarkdownTextProps {
  text: string;
  className?: string;
}

export function MarkdownText({ text, className = "" }: MarkdownTextProps) {
  const renderMarkdown = (content: string): React.ReactElement[] => {
    const lines = content.split("\n");
    const elements: React.ReactElement[] = [];
    let key = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Empty line
      if (!line.trim()) {
        elements.push(<br key={`br-${key++}`} />);
        continue;
      }

      // Bullet list item
      if (line.trim().startsWith("- ")) {
        const content = line.trim().substring(2);
        elements.push(
          <div key={`li-${key++}`} className="flex gap-2 my-1">
            <span className="text-[#8b8475] opacity-60">•</span>
            <span>{renderInline(content)}</span>
          </div>,
        );
        continue;
      }

      // Numbered list item
      if (/^\d+\.\s/.test(line.trim())) {
        const match = line.trim().match(/^(\d+)\.\s(.+)$/);
        if (match) {
          const [, num, content] = match;
          elements.push(
            <div key={`num-${key++}`} className="flex gap-2 my-1">
              <span className="text-[#8b8475] opacity-60">{num}.</span>
              <span>{renderInline(content)}</span>
            </div>,
          );
          continue;
        }
      }

      // Regular line
      elements.push(
        <div key={`line-${key++}`} className="my-1">
          {renderInline(line)}
        </div>,
      );
    }

    return elements;
  };

  const renderInline = (
    text: string,
  ): (string | React.ReactElement)[] | string => {
    const parts: (string | React.ReactElement)[] = [];
    let key = 0;

    // Match **bold** text
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add bold text
      parts.push(
        <strong key={`bold-${key++}`} className="font-semibold">
          {match[1]}
        </strong>,
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return <div className={className}>{renderMarkdown(text)}</div>;
}
