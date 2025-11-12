interface AiResponse {
  response: string;
  remaining_credits: number;
}

interface Message {
  role: string;
  content: string;
}

export async function askAI(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  quick: boolean = true,
): Promise<AiResponse> {
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  const requestBody = {
    model: quick ? "llama-3.1-8b-instant" : "llama-3.3-70b-versatile",
    max_tokens: quick ? 500 : 8192,
    messages,
  };

  let response: Response | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        },
      );
      break;
    } catch (error) {
      if (attempt === 3) {
        throw new Error(`HTTP request failed after 3 attempts: ${error}`);
      }
    }
  }

  if (!response || !response.ok) {
    throw new Error(
      `API request failed with status: ${response?.status || "unknown"}`,
    );
  }

  const responseJson = await response.json();
  const responseText =
    responseJson?.choices?.[0]?.message?.content || "No response from AI";

  return {
    response: responseText,
    remaining_credits: 0, // Simplified - can be enhanced later
  };
}
