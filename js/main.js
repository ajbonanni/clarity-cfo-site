// js/main.js

async function handleUpload() {
  const file = document.getElementById("fileInput")?.files[0] || document.getElementById("fileInput2")?.files[0];
  const uploadStatus = document.getElementById("uploadStatus");
  const resultBox = document.getElementById("diagnosticResults");

  if (!file) return alert("Please select a file.");
  const ext = file.name.split('.').pop().toLowerCase();
  uploadStatus.classList.remove("hidden");
  uploadStatus.textContent = "⏳ Uploading and analyzing...";

  let revenue = 0, expenses = 0;

  const format = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const processAndSend = async () => {
    const burn = expenses - revenue;
    await db.collection("financial_uploads").add({
      filename: file.name, revenue, expenses, burn,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenue, expenses, burn })
      });

      if (!res.ok) throw new Error("GPT fetch failed: " + res.status);
      const { flags, summary, narrative } = await res.json();

      resultBox.innerHTML = `
        <p class="mb-2"><strong>📊 Revenue:</strong> ${format(revenue)} | <strong>Expenses:</strong> ${format(expenses)} | <strong>Burn:</strong> ${format(burn)}</p>
        <p><strong>📊 Summary:</strong> ${summary}</p>
        <p><strong>⚠️ Flags:</strong> ${flags.join(", ")}</p>
        <p><strong>📖 Narrative:</strong> ${narrative}</p>`;
      resultBox.classList.remove("hidden");
      uploadStatus.textContent = "✅ Analysis complete.";
      renderChart(revenue, expenses, burn);
    } catch (err) {
      console.error(err);
      uploadStatus.textContent = "❌ GPT fetch or parse failed: " + err.message;
    }
  };

  if (ext === "csv") {
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        results.data.forEach(row => {
          const name = row["Account"]?.toLowerCase();
          const amt = parseFloat(row["Amount"] || 0);
          if (name?.includes("revenue")) revenue += amt;
          if (name?.includes("expense")) expenses += amt;
        });
        await processAndSend();
      }
    });
  } else if (ext === "xlsx") {
    const reader = new FileReader();
    reader.onload = async e => {
      const wb = XLSX.read(e.target.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet);
      data.forEach(row => {
        const name = row["Account"]?.toLowerCase();
        const amt = parseFloat(row["Amount"] || 0);
        if (name?.includes("revenue")) revenue += amt;
        if (name?.includes("expense")) expenses += amt;
      });
      await processAndSend();
    };
    reader.readAsArrayBuffer(file);
  } else {
    uploadStatus.textContent = "❌ Unsupported file type.";
  }
}

// Extension error suppression
window.addEventListener("error", function(e) {
  if (e.message?.includes("asynchronous response")) e.stopImmediatePropagation();
});
