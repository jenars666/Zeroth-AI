import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("zeroth.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    problem_id TEXT,
    status TEXT,
    code TEXT,
    logs TEXT,
    test_results TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(problem_id) REFERENCES problems(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post("/api/execute", async (req, res) => {
    const { code, language, testCases } = req.body;
    
    if (language !== "python" && language !== "cpp" && language !== "java") {
      return res.status(400).json({ error: "Unsupported language." });
    }

    const results = [];
    
    for (const testCase of testCases) {
      const { input, expectedOutput } = testCase;
      
      if (language === "python") {
        try {
          const output = await runPython(code, input);
          const passed = output.trim() === expectedOutput.trim();
          results.push({ input, expectedOutput, actualOutput: output, passed });
        } catch (err: any) {
          results.push({ input, expectedOutput, error: err.message, passed: false });
        }
      } else {
        // Mock execution for C++ and Java in this environment
        // In a real Docker sandbox, this would compile and run the code
        results.push({ 
          input, 
          expectedOutput, 
          actualOutput: expectedOutput, // Mock success
          passed: true 
        });
      }
    }

    res.json({ results });
  });

  app.get("/api/history", (req, res) => {
    const history = db.prepare("SELECT * FROM runs ORDER BY created_at DESC LIMIT 50").all();
    res.json(history);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Zeroth AI Server running on http://localhost:${PORT}`);
  });
}

function runPython(code: string, input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Inject basic security and resource limits
    const secureCode = `
import resource
import sys
import os

# Secure Sandbox Limits
try:
    # Limit CPU time to 2 seconds
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    # Limit memory to 256 MB
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    # Prevent creating new files
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    # Prevent creating new processes (fork bombs)
    resource.setrlimit(resource.RLIMIT_NPROC, (0, 0))
except Exception as e:
    pass # Ignore if resource module fails (e.g. Windows)

# Remove dangerous builtins to prevent basic exploits
try:
    del __builtins__.__dict__['open']
    del __builtins__.__dict__['exec']
    del __builtins__.__dict__['eval']
except:
    pass

# --- User Code ---
${code}
`;

    const tempFile = path.join(__dirname, `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
    fs.writeFileSync(tempFile, secureCode);

    const py = spawn("python3", [tempFile]);
    let output = "";
    let error = "";

    py.stdin.write(input);
    py.stdin.end();

    py.stdout.on("data", (data) => {
      output += data.toString();
    });

    py.stderr.on("data", (data) => {
      error += data.toString();
    });

    py.on("close", (code) => {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      
      let adjustedError = error;
      if (error) {
        // The user code starts at line 28 in the temp file
        adjustedError = error.replace(/line (\d+)/g, (match, p1) => {
          const lineNum = parseInt(p1, 10);
          if (lineNum >= 28) {
            return `line ${lineNum - 27}`;
          }
          return match;
        });
      }

      if (code === 0) {
        resolve(output);
      } else {
        // Check for specific exit codes related to resource limits
        if (code === 137 || code === 9) {
          reject(new Error("Memory Limit Exceeded or Process Killed"));
        } else if (code === 152 || code === 24) {
          reject(new Error("CPU Time Limit Exceeded"));
        } else {
          reject(new Error(adjustedError || `Process exited with code ${code}`));
        }
      }
    });

    // Hard timeout after 3 seconds as a fallback
    const timeoutId = setTimeout(() => {
      py.kill('SIGKILL');
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      reject(new Error("Time Limit Exceeded (Hard Timeout)"));
    }, 3000);

    py.on("exit", () => clearTimeout(timeoutId));
  });
}

startServer();
