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
            content: "You are a world-class CFO diagnosing financial risks. Respond only in structured, plain English summaries."
          },
          {
            role: "user",
            content: `Analyze this financial snapshot:\nRevenue: ${revenue}\nExpenses: ${expenses}\nBurn: ${burn}\n\nReturn:\n1. Bullet list of Tier 1 risk flags\n2. One-sentence summary\n3. Short GPT-style narrative`
          }
        ],
        temperature: 0.4
      })
    });

    const result = await response.json();
    const message = result.choices?.[0]?.message?.content || "";

    const [flagsText, summary, narrative] = message.split(/\n\n+/);

    res.status(200).json({
      flags: flagsText ? flagsText.split("\n").filter(Boolean) : ["⚠️ No flags returned"],
      summary: summary || "No summary available",
      narrative: narrative || "No narrative available"
    });

  } catch (err) {
    console.error("Diagnostic error:", err);
    res.status(500).json({
      flags: ["⚠️ AI diagnostic unavailable"],
      summary: "AI failed to analyze your file.",
      narrative: "No narrative available."
    });
  }
}
