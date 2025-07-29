const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const readline = require('readline');
const { performance } = require('perf_hooks');
const minimist = require('minimist');
const chalk = require('chalk');
const ora = require('ora').default;
const rlSync = require('readline-sync');

// Parse CLI
const args = minimist(process.argv.slice(2), {
  string: ['w', 'nmp', 'o'],
  alias: { w: 'wordlist', nmp: 'nmapOptions', o: 'outputFile', h: 'help' },
  default: { nmapOptions: '-F', outputFile: 'output.txt' }
});

// Show help if missing args
if (args.help || !args.wordlist) {
  console.log(chalk.blueBright(`
Usage: node nmap -w <wordlist> [-nmp "<nmap options>"] [-o <output file>]

Options:
  -w     Path to subdomain wordlist (required)
  -nmp   Nmap options (default: "-F")
  -o     Output filename (default: output.txt)
  -h     Show help

Example:
  node nmap -w domains.txt -nmp "-p- -T4" -o result.txt
`));
  process.exit(0);
}

// Inputs
const wordlist = args.wordlist;
const nmapOptions = args.nmapOptions;
const outputFile = args.outputFile;

// Create output directory 'nmap'
const outputDir = path.join(__dirname, 'nmap');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Get default concurrency from CPU
let concurrency = Math.max(1, Math.floor(os.cpus().length / 8));
console.log(chalk.cyanBright(`🧠 Detected ${os.cpus().length} logical CPUs`));
console.log(chalk.yellow(`⚙️ Using default concurrency: ${concurrency}`));

// Ask user if they want to override
const answer = rlSync.question(chalk.magentaBright(`\nDo you want to change the concurrency? (y/n): `));
if (answer.toLowerCase() === 'y') {
  const userInput = rlSync.question(chalk.white(`Enter custom concurrency (1 - ${os.cpus().length}): `));
  const val = parseInt(userInput);
  if (!isNaN(val) && val >= 1 && val <= os.cpus().length) {
    concurrency = val;
    console.log(chalk.greenBright(`✅ Concurrency set to: ${concurrency}\n`));
  } else {
    console.log(chalk.red(`❌ Invalid input. Keeping default concurrency: ${concurrency}\n`));
  }
}

function readWordlist(filePath) {
  return new Promise((resolve, reject) => {
    const list = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });
    rl.on('line', (line) => {
      const domain = line.trim();
      if (domain) list.push(domain);
    });
    rl.on('close', () => resolve(list));
    rl.on('error', reject);
  });
}

function runNmap(domain, options) {
  return new Promise((resolve) => {
    exec(`nmap ${options} ${domain}`, { timeout: 120000 }, (error, stdout, stderr) => {
      resolve({ domain, output: stdout + stderr, error });
    });
  });
}

function writeToFile(filename, lines) {
  return fs.promises.writeFile(filename, lines.join('\n'), 'utf8');
}

function writeHtml(results, filename) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Nmap Scan Report</title>
<style>
body { font-family: Arial; background: #f4f4f4; padding: 20px; }
.result { background: #fff; border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 8px; }
h2 { color: #003366; }
pre { background: #eee; padding: 10px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; }
</style></head><body>
<h1>Nmap Scan Report</h1>
${results.map(r => `
<div class="result">
  <h2>${r.domain}</h2>
  <pre>${r.output.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</div>`).join('\n')}
</body></html>`;
  return fs.promises.writeFile(filename, html, 'utf8');
}

// MAIN
(async () => {
  const domains = await readWordlist(wordlist);
  const total = domains.length;
  const start = performance.now();
  const queue = [...domains];
  const success = [], failed = [], textOutput = [], htmlOutput = [];
  let completed = 0;

  console.log(chalk.cyanBright(`\n🚀 Starting scan of ${total} subdomains with concurrency: ${concurrency}\n`));
  const spinner = ora({ text: 'Initializing scans...', spinner: 'dots' }).start();

  const workers = Array.from({ length: concurrency }, () => (async function worker() {
    while (queue.length) {
      const domain = queue.pop();
      if (!domain) return;

      spinner.text = chalk.gray(`Scanning: ${domain} | Completed: ${completed}/${total}`);
      const result = await runNmap(domain, nmapOptions);
      completed++;
      const elapsed = (performance.now() - start) / 1000;
      const eta = ((elapsed / completed) * (total - completed)).toFixed(0);

      if (!result.error) {
        success.push(domain);
        textOutput.push(`[+] ${domain}\n${result.output}`);
        htmlOutput.push({ domain: result.domain, output: result.output });
      } else {
        failed.push(domain);
        textOutput.push(`[-] ${domain} (Error: ${result.error.message || 'Unknown'})`);
      }

      spinner.text = chalk.cyan(`Progress: ${completed}/${total} | ETA: ${eta}s`);
    }
  })());

  await Promise.all(workers);
  spinner.succeed(chalk.green(`✔ Scan completed for ${total} domains\n`));

  // Save all outputs in 'nmap' folder
  const outputTxtPath = path.join(outputDir, outputFile);
  const outputHtmlPath = path.join(outputDir, outputFile.replace('.txt', '.html'));
  const successPath = path.join(outputDir, 'success.txt');
  const failedPath = path.join(outputDir, 'failed.txt');

  await writeToFile(outputTxtPath, textOutput);
  await writeHtml(htmlOutput, outputHtmlPath);
  await writeToFile(successPath, success);
  await writeToFile(failedPath, failed);

  console.log(chalk.greenBright(`📁 Output written to:`));
  console.log(`  📝 ${chalk.bold(path.relative(__dirname, outputTxtPath))}`);
  console.log(`  🌐 ${chalk.bold(path.relative(__dirname, outputHtmlPath))}`);
  console.log(`  ✅ ${chalk.bold('nmap/success.txt')}`);
  console.log(`  ❌ ${chalk.bold('nmap/failed.txt')}`);
})();
