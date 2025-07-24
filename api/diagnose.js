export default async function handler(req, res) {
  const { revenue, expenses, burn, filename } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a world-class CFO diagnosing financial risks. Respond ONLY in valid JSON format as specified."
          },
          {
            role: "user",
            content: `Analyze this financial snapshot:
Revenue: ${revenue}
Expenses: ${expenses}
Burn: ${burn}

Return a JSON object with this exact structure:
{
  "flags": ["string"],
  "summary": "string",
  "narrative": "string"
}

Do not include commentary. Do not return markdown. Strictly return valid JSON only.`
          }
        ],
        temperature: 0.4
      })
    });

    const result = await response.json();

    // Try to safely extract JSON content
    const content = result.choices?.[0]?.message?.content || "";
    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}") + 1;
    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd));

    res.status(200).json({
      flags: parsed.flags || ["⚠️ No flags returned"],
      summary: parsed.summary || "No summary available",
      narrative: parsed.narrative || "No narrative available"
    });

  } catch (error) {
    console.error("🛑 Error in diagnose API:", error);
    res.status(500).json({
      flags: ["⚠️ AI diagnostic unavailable"],
      summary: "AI failed to analyze your file. Please try again later.",
      narrative: "No narrative available"
    });
  }
}
