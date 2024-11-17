import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { syncTalks } from "~/sync/sync-to-db";

// Define the environment interface
interface Env {
  DB: D1Database;
  // Add other env variables here as needed
}

// Extend the LoaderFunctionArgs to include our env type
interface LoaderArgs extends LoaderFunctionArgs {
  context: {
    env: Env;
  };
}

// Verify the request is from Cloudflare
const verifyCloudflareWorkerRequest = (request: Request) => {
  const cfWorkerHeader = request.headers.get("CF-Worker");
  if (!cfWorkerHeader) {
    throw new Response("Unauthorized", { status: 401 });
  }
};

export async function loader({ request, context }: LoaderArgs) {
  try {
    // Only allow GET requests
    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    // Verify the request is from Cloudflare
    verifyCloudflareWorkerRequest(request);

    // Get the database from context (now properly typed)
    const db = context.env.DB;
    if (!db) {
      throw new Error("Database not found in context");
    }

    // Run the sync
    await syncTalks(db);

    return json({ success: true, message: "Sync completed successfully" });
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
