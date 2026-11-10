import { z } from "zod";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// A single workout block: [duration_in_minutes, watt]
type ErgBlock = [number, number];

// Define the input schema for the tool
const ExportWorkoutErgInputSchema = z.object({
    name: z.string().describe("Name of the workout."),
    ftp: z.number().int().default(220).describe("Functional Threshold Power in watts (default 220)."),
    date: z.string().optional().describe("Optional ISO date (e.g. 2024-12-03). Used in the file name. Defaults to today."),
    blocks: z
        .array(z.tuple([z.number().min(0).describe("Duration in minutes."), z.number().describe("Watt.")]))
        .min(1)
        .describe("Ordered list of workout blocks, each as [duration_in_minutes, watt]."),
});

// Infer the input type from the schema
type ExportWorkoutErgInput = z.infer<typeof ExportWorkoutErgInputSchema>;

// Convert an ISO date string (or today) to YYYY-MM-DD
function dateToYYYYMMDD(iso?: string): string {
    const parsed = iso ? new Date(iso) : new Date();
    const date = isNaN(parsed.getTime()) ? new Date() : parsed;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

// Make a name filesystem-safe
function sanitizeName(name: string): string {
    const safe = name
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    return safe || "workout";
}

// Format a cumulative minutes value, dropping trailing zeros (5 -> "5", 5.5 -> "5.5")
function formatMinutes(minutes: number): string {
    const rounded = Math.round(minutes * 100) / 100;
    return String(rounded);
}

// Generate the full ERG file content
function generateErgContent(
    name: string,
    ftp: number,
    dateStr: string,
    safeName: string,
    blocks: ErgBlock[]
): string {
    const fileName = `${dateStr}_${safeName}.erg`;

    // ERG course data: one line per block. The minute value is the CUMULATIVE
    // time at which that block's watt level STARTS. Every ERG ramp begins at
    // minute 0, so the first line is always "0\t<watt of first block>". A line
    // is emitted for every block in sequence (no merging) — if two adjacent
    // blocks share a watt you simply get the same watt at two successive
    // start-times, which the erg program treats as one continuous segment.
    let cumulative = 0;
    const data: string[] = [];
    for (const [duration, watt] of blocks) {
        data.push(`${formatMinutes(cumulative)}\t${watt}`);
        cumulative += duration;
    }

    const lines = [
        "[COURSE HEADER]",
        "VERSION = 2",
        "UNITS = ENGLISH",
        `DESCRIPTION = ${name}`,
        `FILE NAME = ${fileName}`,
        `FTP = ${ftp}`,
        "MINUTES WATTS",
        "[END COURSE HEADER]",
        "[COURSE DATA]",
        ...data,
        "[END COURSE DATA]",
    ];

    return lines.join("\n") + "\n";
}

// Export the tool definition directly
export const exportWorkoutErg = {
    name: "export_workout_erg",
    description:
        "Generates a .erg course/workout file from a list of [duration_minutes, watt] blocks and saves it to the user's ~/Downloads folder. Returns the full path and the file content.",
    inputSchema: ExportWorkoutErgInputSchema,
    execute: async ({ name, ftp, date, blocks }: ExportWorkoutErgInput) => {
        try {
            // Default applied in the schema too; re-applied here so the function
            // is correct even when invoked without MCP-layer parsing.
            const effectiveFtp = ftp ?? 220;
            const dateStr = dateToYYYYMMDD(date);
            const safeName = sanitizeName(name);
            const content = generateErgContent(name, effectiveFtp, dateStr, safeName, blocks as ErgBlock[]);

            // Ensure the Downloads directory exists
            const downloadsDir = path.join(os.homedir(), "Downloads");
            if (!fs.existsSync(downloadsDir)) {
                fs.mkdirSync(downloadsDir, { recursive: true });
            }

            const fullPath = path.join(downloadsDir, `${dateStr}_${safeName}.erg`);
            fs.writeFileSync(fullPath, content, "utf-8");

            // Return both the full path and the file content
            const text = `✅ Workout "${name}" exported as ERG to: ${fullPath}\n\n${content}`;
            return {
                content: [{ type: "text" as const, text }],
            };
        } catch (err: any) {
            console.error(`Error in export_workout_erg tool:`, err);
            let userMessage = `❌ Error exporting workout "${name}" as ERG: ${err.message}`;
            if (err.code === "EACCES") {
                userMessage = "❌ Error: No write permission for the Downloads directory.";
            }
            return {
                content: [{ type: "text" as const, text: userMessage }],
                isError: true,
            };
        }
    },
};
