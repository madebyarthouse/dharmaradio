/**
 * Script to test if the Cloudflare API token is still valid
 *
 * Usage: pnpm tsx scripts/test-cloudflare-token.ts
 */

const CLOUDFLARE_API_TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  "mVFNQwdg9-8WNg7VkNLc6Wut9E4MCCQPZVfH14CM";
const CLOUDFLARE_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || "cc55fa80df45756617dc52abb11ab6d2";

async function testCloudflareToken() {
  console.log("🔍 Testing Cloudflare API Token...\n");

  try {
    // Test 1: Verify token with user endpoint
    console.log("Test 1: Verifying token with /user/tokens/verify endpoint...");
    const verifyResponse = await fetch(
      "https://api.cloudflare.com/client/v4/user/tokens/verify",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const verifyData = await verifyResponse.json();

    if (verifyResponse.ok && verifyData.success) {
      console.log("✅ Token is VALID");
      console.log("   Status:", verifyData.result.status);
      console.log("   ID:", verifyData.result.id);
      if (verifyData.result.expires_on) {
        console.log("   Expires:", verifyData.result.expires_on);
      }
    } else {
      console.log("❌ Token is INVALID or EXPIRED");
      console.log("   Response:", JSON.stringify(verifyData, null, 2));
      return;
    }

    console.log("\n");

    // Test 2: Check account access
    console.log("Test 2: Checking account access...");
    const accountResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const accountData = await accountResponse.json();

    if (accountResponse.ok && accountData.success) {
      console.log("✅ Account access: GRANTED");
      console.log("   Account Name:", accountData.result.name);
      console.log("   Account ID:", accountData.result.id);
    } else {
      console.log("❌ Account access: DENIED");
      console.log("   Response:", JSON.stringify(accountData, null, 2));
    }

    console.log("\n");

    // Test 3: List D1 databases
    console.log("Test 3: Checking D1 database access...");
    const d1Response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    const d1Data = await d1Response.json();

    if (d1Response.ok && d1Data.success) {
      console.log("✅ D1 database access: GRANTED");
      console.log("   Databases found:", d1Data.result.length);
      if (d1Data.result.length > 0) {
        console.log(
          "   Database names:",
          d1Data.result.map((db: any) => db.name).join(", "),
        );
      }
    } else {
      console.log("❌ D1 database access: DENIED");
      console.log("   Response:", JSON.stringify(d1Data, null, 2));
    }

    console.log("\n");
    console.log("=".repeat(60));
    console.log("⚠️  IMPORTANT: If token is valid, REVOKE IT IMMEDIATELY at:");
    console.log("   https://dash.cloudflare.com/profile/api-tokens");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("❌ Error testing token:", error);
  }
}

testCloudflareToken();


