import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { STTProvider } from "./provider";
import type { Transcript, Word } from "@/types";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "nvidia_transcribe.py");

/**
 * NVIDIA Riva Parakeet-TDT, via NVCF's hosted gRPC endpoint. Word-level
 * timestamps aren't exposed on this model's HTTP REST endpoint (confirmed
 * against NVIDIA's docs) — only through the gRPC API — so this shells out to
 * a small Python script (scripts/nvidia_transcribe.py) built on NVIDIA's own
 * `nvidia-riva-client` package rather than reimplementing the protobuf wire
 * format by hand. Requires Python 3 + `pip install -U nvidia-riva-client` on
 * the machine running the Next.js server.
 */
export class NvidiaParakeetProvider implements STTProvider {
  readonly id = "nvidia-parakeet";
  private pythonBin: string;

  constructor(
    private apiKey: string,
    private functionId: string,
    private languageCode = "en-US"
  ) {
    this.pythonBin = process.platform === "win32" ? "python" : "python3";
  }

  async transcribe(audio: Buffer, filename: string): Promise<Transcript> {
    const dir = await mkdtemp(path.join(tmpdir(), "nvidia-asr-"));
    const wavPath = path.join(dir, filename.endsWith(".wav") ? filename : `${filename}.wav`);
    await writeFile(wavPath, audio);

    try {
      const stdout = await runPython(
        this.pythonBin,
        [SCRIPT_PATH, wavPath, this.languageCode],
        { NVIDIA_API_KEY: this.apiKey, NVIDIA_FUNCTION_ID: this.functionId }
      );

      const lines = stdout.trim().split("\n").filter(Boolean);
      const parsed = JSON.parse(lines[lines.length - 1] ?? "{}");
      if (parsed.error) throw new Error(parsed.error);

      const words: Word[] = (parsed.words ?? []).map(
        (w: { text: string; start: number; end: number }) => ({
          text: w.text,
          start: w.start,
          end: w.end,
        })
      );

      return { words, language: parsed.language };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function runPython(bin: string, args: string[], extraEnv: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { env: { ...process.env, ...extraEnv } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(
          new Error(
            `Could not find "${bin}" on PATH. Install Python 3, then run: pip install -U nvidia-riva-client`
          )
        );
      } else {
        reject(err);
      }
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `nvidia_transcribe.py exited with code ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
}
