import { Config } from '@remotion/cli/config';

// Use the locally installed Chrome rather than downloading Remotion's own
// headless shell - same convention as tests/harness.mjs.
Config.setBrowserExecutable(
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
);
Config.setOverwriteOutput(true);
Config.setStillImageFormat('png');
