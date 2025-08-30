// main.js

import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import Papa from "https://cdn.jsdelivr.net/npm/papaparse@5.3.2/+esm";

document.getElementById('fileInput2').addEventListener('change', handleUpload);

async function handleUpload() {
  const fileInput = document.getElementById('fileInput2');
  const file = fileInput.files[0];

  if (!file) {
    alert("Please select a file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    const csvData = e.target.result;

    Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: async function (results) {
        const data = results.data;
        let totalRevenue = 0;
        let totalExpenses = 0;

        for (let row of data) {
          const label = row["Category"] || row["Label"] || "";
          const amountStr = row["Amount"] || row["Value"] || "0";
          const amount = parseFloat(amountStr.replace(/[^0-9.-]+/g, ''));

          if (isNaN(amount)) continue;
          if (label.toLowerCase().includes("revenue")) totalRevenue += amount;
          else if (label.toLowerCase().includes("expense") || label.toLowerCase().includes("cost")) totalExpenses += amount;
        }

        const burnRate = totalRevenue - totalExpenses;
        const summary = `
          Total Revenue: $${totalRevenue.toFixed(2)}
          Total Expenses: $${totalExpenses.toFixed(2)}
          Net Burn: $${burnRate.toFixed(2)}
        `;

        document.getElementById('diagnosticResults').innerText = summary;
        document.getElementById('diagnosticResults').classList.remove("hidden");

        try {
          await addDoc(collection(db, "uploads"), {
            revenue: totalRevenue,
            expenses: totalExpenses,
            burnRate: burnRate,
            timestamp: serverTimestamp()
          });
          document.getElementById("uploadStatus").innerText = "✅ Upload successful";
        } catch (err) {
          console.error("Upload error: ", err);
          document.getElementById("uploadStatus").innerText = "❌ Upload failed";
        }

        document.getElementById("uploadStatus").classList.remove("hidden");
      }
    });
  };

  reader.readAsText(file);
}
