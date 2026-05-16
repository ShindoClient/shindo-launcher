import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";

const srcMainview = path.resolve(import.meta.dirname, "src/mainview");
const srcShared = path.resolve(import.meta.dirname, "src/shared");

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		conditions: ["browser"],
		alias: {
			$mainview: srcMainview,
			$shared: srcShared,
		},
	},
	test: {
		environment: "jsdom",
		include: ["tests/**/*.test.ts"],
		setupFiles: ["./src/mainview/test-setup.ts"],
		server: {
			deps: {
				inline: [/^svelte/],
			},
		},
	},
});
