import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase", () => ({ requireSupabase: () => ({ rpc }) }));
import { exportBackup } from "./backup";

describe("consistent backup export", () => {
  beforeEach(() => rpc.mockReset());
  it("reads the related records through one database snapshot RPC", async () => {
    const data = { format: "dailymark", version: 2, createdAt: "2026-10-20T00:00:00Z", notebooks: [], notes: [], thoughtSources: [] };
    rpc.mockResolvedValue({ data, error: null });
    expect(await exportBackup(() => {})).toEqual(data);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("export_backup", {});
  });
  it("never falls back to inconsistent separate reads when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Export unavailable" } });
    await expect(exportBackup(() => {})).rejects.toEqual({ message: "Export unavailable" });
  });
  it("rejects an invalid snapshot before offering a download", async () => {
    rpc.mockResolvedValue({ data: { format: "dailymark", version: 2, notebooks: [], notes: [], thoughtSources: [{ note_id: "missing" }] }, error: null });
    await expect(exportBackup(() => {})).rejects.toThrow("Invalid thought source");
  });
});
