import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // Branches of test are NOT disposable: they hold TEST_DATABASE_URL for
      // the backend suite (see backend/test/helpers.js). Expiring one would
      // silently revert the suite to its skip path — a false green. Create it
      // with `neon checkout test`, then keep its expiration cleared.
      if (branch.name === "test") {
        return {};
      }
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
