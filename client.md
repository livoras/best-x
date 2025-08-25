Usage
As a JavaScript/TypeScript SDK
You can use the PlaywrightClient SDK programmatically in your Node.js applications:

Prerequisites:

First, start the HTTP server:

npx better-playwright-mcp@latest server
Then use the SDK in your code:

import { PlaywrightClient } from 'better-playwright-mcp';

async function automateWebPage() {
  // Connect to the HTTP server (must be running)
  const client = new PlaywrightClient('http://localhost:3103');

  // Create a page
  const { pageId, snapshot } = await client.createPage(
    'my-page',        // page name
    'Test page',      // description
    'https://example.com'  // URL
  );

  // Save the processed HTML to a file
  const result = await client.pageToHtmlFile(pageId);
  console.log('HTML saved to:', result.filePath);
  // Returns: { filePath: "/tmp/page-abc123.html", fileSize: 12345, ... }

  // Get a semantic snapshot (with xp references)
  const snapshot = await client.getPageSnapshot(pageId);
  console.log(snapshot);
  // Returns simplified HTML like:
  // div xp=6204242d
  //   h1 xp=3fed137b Example Domain
  //   p xp=070e2633 This domain is for use...

  // Interact with the page using xp references from snapshot
  await client.browserClick(pageId, '3fed137b');  // Click the h1 element
  await client.browserType(pageId, '070e2633', 'Hello World', true);  // Type and submit

  // Take screenshots
  const screenshot = await client.getScreenshot(pageId, { fullPage: true });

  // Clean up
  await client.closePage(pageId);
}
Available Methods:

Page Management: createPage, closePage, listPages, activatePage
Navigation: browserNavigate, browserNavigateBack, browserNavigateForward
Interaction: browserClick, browserType, browserHover, browserSelectOption
Snapshots: getPageSnapshot, pageToHtmlFile, getScreenshot, getPDFSnapshot
Utilities: waitForTimeout, waitForSelector, scrollToBottom, scrollToTop
