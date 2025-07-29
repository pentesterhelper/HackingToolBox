const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const os = require('os');

// Dynamic concurrency based on available CPUs
const MAX_CONCURRENT = Math.min(200, os.cpus().length * 25);
const DOH_URL = 'https://dns.google/resolve';
const TIMEOUT_MS = 60000;

// Terminal colors and styling
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

// Helper functions for styled output
const formatTime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

const getProgressBar = (current, total, width = 30) => {
  const percentage = Math.min(100, (current / total) * 100);
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;
  
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${colors.cyan}[${bar}]${colors.reset} ${percentage.toFixed(1)}%`;
};

const printScanInfo = (target, wordlistPath, total) => {
  const separator = `${colors.dim}${'─'.repeat(70)}${colors.reset}`;
  
  console.log(separator);
  console.log(`${colors.cyan}🌐 Website          ${colors.reset}: ${colors.yellow}https://pentesterhelper.in${colors.reset}`);
  console.log(`${colors.cyan}🎯 Target Domain    ${colors.reset}: ${colors.bright}${colors.white}${target}${colors.reset}`);
  console.log(`${colors.cyan}📂 Wordlist         ${colors.reset}: ${colors.green}${path.basename(wordlistPath)}${colors.reset}`);
  console.log(`${colors.cyan}🔢 Total Subdomains ${colors.reset}: ${colors.yellow}${total.toLocaleString()}${colors.reset}`);
  console.log(`${colors.cyan}⚙️ Max Concurrency  ${colors.reset}: ${colors.magenta}${MAX_CONCURRENT}${colors.reset}`);
  console.log(`${colors.cyan}🧵 CPU Cores        ${colors.reset}: ${colors.blue}${os.cpus().length}${colors.reset}`);
  console.log(`${colors.cyan}⏲️ Timeout          ${colors.reset}: ${colors.red}${TIMEOUT_MS/1000}s${colors.reset}`);
  console.log(separator);
  console.log(`${colors.bright}${colors.green}🚀 INITIATING SCAN...${colors.reset}\n`);
};

const printProgress = (done, total, found, elapsed, rate) => {
  const progressBar = getProgressBar(done, total);
  const timeStr = formatTime(elapsed * 1000);
  const eta = done > 0 ? formatTime(((total - done) / rate) * 1000) : 'calculating...';
  
  // Clear previous progress line
  process.stdout.write('\r\x1b[K');
  
  const status = `${colors.bright}${colors.blue}PROGRESS${colors.reset}` +
               `${colors.cyan}[${done.toLocaleString()}/${total.toLocaleString()}]${colors.reset} ` +
               `${colors.green}Found: ${found}${colors.reset} ` +
               `${colors.yellow}⏱️ ${timeStr}${colors.reset} ` +
               `${colors.magenta}⚡ ${rate.toFixed(1)}/s${colors.reset} ` +
               `${colors.dim}ETA: ${eta}${colors.reset}`;
  
  process.stdout.write(status);
  
  if (done === total) {
    console.log(); // New line when complete
  }
};

const printFoundSubdomain = (subdomain, ip) => {
  console.log(`${colors.bright}${colors.green}[FOUND]${colors.reset} ${colors.cyan}${subdomain}${colors.reset} ${colors.dim}→${colors.reset} ${colors.yellow}${ip}${colors.reset}`);
};

const printSummary = (found, duration, resultFile) => {
  const separator = `${colors.dim}${'═'.repeat(70)}${colors.reset}`;
  
  console.log(`\n${separator}`);
  console.log(`${colors.bright}${colors.green}✅ SCAN COMPLETED SUCCESSFULLY${colors.reset}`);
  console.log(separator);
  console.log(`${colors.cyan}⏱️  Total Duration   ${colors.reset}: ${colors.yellow}${formatTime(duration * 1000)}${colors.reset}`);
  console.log(`${colors.cyan}🎯 Subdomains Found ${colors.reset}: ${colors.bright}${colors.green}${found.length}${colors.reset}`);
  console.log(`${colors.cyan}📁 Results File     ${colors.reset}: ${colors.blue}${path.basename(resultFile)}${colors.reset}`);
  console.log(separator);
  
  if (found.length > 0) {
    console.log(`${colors.bright}${colors.white}DISCOVERED SUBDOMAINS:${colors.reset}`);
    console.log(`${colors.dim}${'─'.repeat(70)}${colors.reset}`);
    found.forEach((result, index) => {
      console.log(`${colors.dim}${(index + 1).toString().padStart(3)}${colors.reset}. ${colors.cyan}${result.subdomain}${colors.reset} ${colors.dim}→${colors.reset} ${colors.yellow}${result.ip}${colors.reset}`);
    });
  } else {
    console.log(`${colors.yellow}⚠️  No subdomains were discovered${colors.reset}`);
  }
  
  console.log(`\n${colors.bright}${colors.green}🎉 Happy Hunting!${colors.reset}\n`);
};

async function resolveSubdomain(subdomain) {
  try {
    const res = await axios.get(DOH_URL, {
      params: { name: subdomain, type: 'A' },
      timeout: TIMEOUT_MS
    });
    const answers = res.data.Answer;
    if (answers && answers.length > 0) {
      const ips = answers.map(a => a.data).join(', ');
      return { subdomain, ip: ips };
    }
  } catch (_) {}
  return null;
}

async function scan(target, wordlistPath) {
  // Validate inputs
  if (!fs.existsSync(wordlistPath)) {
    console.log(`${colors.red}❌ Error: Wordlist file not found: ${wordlistPath}${colors.reset}`);
    process.exit(1);
  }

  const words = fs.readFileSync(wordlistPath, 'utf-8').split(/\r?\n/).filter(Boolean);
  const total = words.length;
  const found = [];
  let done = 0;
  let lastUpdate = 0;

  // Print header and scan info
  printScanInfo(target, wordlistPath, total);

  const startTime = performance.now();
  const queue = [...words];
  const workers = [];

  // Create worker pool
  for (let i = 0; i < MAX_CONCURRENT; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const word = queue.shift();
        if (!word) break;
        
        const subdomain = `${word.trim()}.${target}`;
        const result = await resolveSubdomain(subdomain);
        done++;

        if (result) {
          found.push(result);
          printFoundSubdomain(result.subdomain, result.ip);
        }

        // Update progress every 0.5 seconds or when complete
        const now = performance.now();
        if (now - lastUpdate > 500 || done === total) {
          lastUpdate = now;
          const elapsed = (now - startTime) / 1000;
          const rate = done / elapsed;
          printProgress(done, total, found.length, elapsed, rate);
        }
      }
    })());
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  const duration = (performance.now() - startTime) / 1000;
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const resultFile = path.join(__dirname, `subdomains-${target}-${timestamp}.txt`);
  
  if (found.length > 0) {
    const content = found.map(r => `${r.subdomain} → ${r.ip}`).join('\n');
    fs.writeFileSync(resultFile, content, 'utf-8');
  }

  // Print final summary
  printSummary(found, duration, resultFile);
}

// Enhanced CLI handling
const showUsage = () => {
  console.log(`${colors.bright}Usage:${colors.reset}`);
  console.log(`  ${colors.green}node fuzzSub <target.com> <wordlist.txt>${colors.reset}\n`);
  console.log(`${colors.bright}Examples:${colors.reset}`);
  console.log(`  ${colors.cyan}node fuzzSub example.com subdomains.txt${colors.reset}`);
  console.log(`  ${colors.cyan}node fuzzSub target.org /path/to/wordlist.txt${colors.reset}\n`);
  console.log(`${colors.bright}Requirements:${colors.reset}`);
  console.log(`  ${colors.yellow}• Valid domain name${colors.reset}`);
  console.log(`  ${colors.yellow}• Accessible wordlist file${colors.reset}`);
  console.log(`  ${colors.yellow}• Internet connection${colors.reset}\n`);
};

// Main execution
const [, , target, wordlistFile] = process.argv;

if (!target || !wordlistFile) {
  showUsage();
  process.exit(1);
}

// Validate domain format
const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;
if (!domainRegex.test(target)) {
  console.log(`${colors.red}❌ Error: Invalid domain format: ${target}${colors.reset}`);
  process.exit(1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\n${colors.yellow}⚠️  Scan interrupted by user${colors.reset}`);
  console.log(`${colors.dim}Cleaning up and exiting...${colors.reset}`);
  process.exit(0);
});

// Start the scan
scan(target, wordlistFile).catch(error => {
  console.error(`${colors.red}❌ Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});