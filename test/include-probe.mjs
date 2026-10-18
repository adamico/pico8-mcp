// #include probe: boots fixture carts that use #include through the MCP server
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const fixture = (f) => new URL(`./fixtures/include/${f}`, import.meta.url).pathname;
const text = (r) => r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

const client = new Client({ name: "include-probe", version: "0.0.0" });
await client.connect(
  new StdioClientTransport({
    command: "node",
    args: [new URL("../dist/index.js", import.meta.url).pathname],
  }),
);

let r = await client.callTool({
  name: "pico8_boot",
  arguments: { cart_path: fixture("include.p8"), screenshot: false },
});
if (r.isError) fail(`boot with #include failed: ${text(r)}`);

r = await client.callTool({
  name: "pico8_read",
  arguments: { globals: ["lib_ok", "lib_col", "tab0", "tab1", "tab2"] },
});
const out = text(r);
console.log(out);
for (const want of [/lib_ok\W+true/, /lib_col\W+8/, /tab0\W+nil/, /tab1\W+true/, /tab2\W+nil/]) {
  if (!want.test(out)) fail(`expected ${want} in pico8_read output`);
}
await client.callTool({ name: "pico8_shutdown", arguments: {} });

r = await client.callTool({ name: "pico8_boot", arguments: { cart_path: fixture("missing.p8") } });
console.log(text(r));
if (!r.isError || !/missing\.lua/.test(text(r))) fail("missing include should be a tool error naming the file");

await client.close();
console.log("\n=== INCLUDE PROBE OK ===");
process.exit(0);
