import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { syncTalks } from "~/sync/sync-to-db";
import { syncTeachers } from "~/sync/sync-teachers";

type SyncCommand = "teachers" | "all";

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    // Only allow GET requests
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Get the database from context
    const db = context.cloudflare.env.DB;
    if (!db) {
      throw new Error("Database not found in context");
    }

    // Parse URL parameters
    const url = new URL(request.url);
    const skipProcessing = url.searchParams.get("skipProcessing") === "true";
    const command = (url.searchParams.get("command") || "all") as SyncCommand;

    const results: Record<string, { success: boolean; error?: string }> = {};

    // Execute requested sync commands
    switch (command) {
      case "teachers":
        await syncTeachers(db);
        results.teachers = { success: true };
        break;

      case "all":
        try {
          await syncTeachers(db);
          results.teachers = { success: true };
        } catch (error) {
          results.teachers = {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }

        try {
          await syncTalks(db, skipProcessing);
          results.talks = { success: true };
        } catch (error) {
          results.talks = {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
        break;

      default:
        return json(
          { error: `Unknown sync command: ${command}` },
          { status: 400 }
        );
    }

    // Check if any sync operations failed
    const anyFailures = Object.values(results).some((r) => !r.success);
    const status = anyFailures ? 500 : 200;

    return json(
      {
        success: !anyFailures,
        results,
        message: skipProcessing
          ? "Sync completed (processing skipped)"
          : "Sync completed",
      },
      { status }
    );
  } catch (error) {
    console.error("Error in sync endpoint:", error);
    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
