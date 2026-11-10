import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The only side effect of execute() is writing to ~/Downloads. Mock it so the
// test stays deterministic and never touches the real home directory.
vi.mock("node:fs", () => ({
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
}));
vi.mock("node:os", () => ({ homedir: () => "/home/tester" }));

import * as fs from "node:fs";
import { exportWorkoutErg } from "../src/tools/exportWorkoutErg.js";

function dataLines(text: string): string[] {
    const start = text.indexOf("[COURSE DATA]\n") + "[COURSE DATA]\n".length;
    const end = text.indexOf("\n[END COURSE DATA]");
    return text.slice(start, end).split("\n");
}

describe("export_workout_erg tool", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts COURSE DATA at minute 0, one line per block, no merging", async () => {
        const { content } = await exportWorkoutErg.execute({
            name: "Test Ride",
            blocks: [[5, 200], [10, 250], [5, 250], [15, 180]],
        });

        const text = content[0].text;
        // Cumulative START time per block: 0, 5, 15, 20. Consecutive same-watt
        // blocks (250 -> 250) are NOT merged — both appear at their own start time.
        expect(dataLines(text)).toEqual(["0\t200", "5\t250", "15\t250", "20\t180"]);
    });

    it("keeps the full header exactly as the spec requires", async () => {
        const { content } = await exportWorkoutErg.execute({
            name: "Sprint Intervals",
            ftp: 260,
            date: "2024-12-03",
            blocks: [[1, 100], [2, 300]],
        });
        const text = content[0].text;

        expect(text).toContain("[COURSE HEADER]\n");
        expect(text).toContain("VERSION = 2\n");
        expect(text).toContain("UNITS = ENGLISH\n");
        expect(text).toContain("DESCRIPTION = Sprint Intervals\n");
        expect(text).toContain("FILE NAME = 2024-12-03_Sprint_Intervals.erg\n");
        expect(text).toContain("FTP = 260\n");
        expect(text).toContain("MINUTES WATTS\n");
        expect(text).toContain("[END COURSE HEADER]\n");
        expect(text).toContain("[COURSE DATA]\n");
        expect(text).toContain("[END COURSE DATA]\n");
    });

    it("writes the file to ~/Downloads and returns the path + content", async () => {
        const { content } = await exportWorkoutErg.execute({
            name: "My Ride",
            date: "2024-12-03",
            blocks: [[10, 150]],
        });

        const text = content[0].text;
        const fullPath = "/home/tester/Downloads/2024-12-03_My_Ride.erg";

        // writeFileSync(fullPath, content, "utf-8")
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        const [pathArg, contentArg] = vi.mocked(fs.writeFileSync).mock.calls[0]!;
        expect(pathArg).toBe(fullPath);
        expect(typeof contentArg).toBe("string");

        // Return value includes both the path and the file content.
        expect(text).toContain(fullPath);
        expect(text).toContain("[COURSE DATA]");
        expect(text).toContain("0\t150");
    });

    it("defaults ftp to 220 when not provided", async () => {
        const { content } = await exportWorkoutErg.execute({
            name: "Default Ftp",
            date: "2024-12-03",
            blocks: [[5, 200]],
        });
        expect(content[0].text).toContain("FTP = 220");
    });
});
