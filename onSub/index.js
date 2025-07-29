const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');

// Terminal colors
const COLORS = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m'
};

// Globals
const configPath = path.join(__dirname, 'key.config.js');
let virustotalKey = '';

// Prompt API key and exit
function promptForKeyAndExit() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('🔐 Enter your VirusTotal API Key: ', (key) => {
    const sanitized = key.trim();
    const content = `module.exports = { virustotalKey: '${sanitized}' };`;
    fs.writeFileSync(configPath, content);
    console.log(`${COLORS.green}✅ API key saved to key.config.js. Please rerun the script with a domain.${COLORS.reset}`);
    rl.close();
    process.exit(0);
  });
}

// Entry
(async function checkKeyAndStart() {
  if (!fs.existsSync(configPath)) {
    promptForKeyAndExit();
    return;
  }

  try {
    ({ virustotalKey } = require('./key.config'));
    if (!virustotalKey || virustotalKey.length < 5) {
      promptForKeyAndExit();
      return;
    }
  } catch (e) {
    promptForKeyAndExit();
    return;
  }

  await init(); // Start main logic only after valid key is loaded
})();

// === MAIN LOGIC ===
async function init() {
  const domain = process.argv[2];
  const uniqueSet = new Set();
  const errors = [];

  if (!domain) {
    console.error(`\n${COLORS.red}❌ Please provide a domain.\nUsage: node onSub example.com${COLORS.reset}\n`);
    process.exit(1);
  }

  const sources = [
    fetchArchiveOrg,
    fetchCertspotter,
    fetchVirusTotal,
    fetchCrtsh,
    fetchRapidDNS
  ];

  console.log(`${COLORS.cyan}${COLORS.bold}\n🔎 Subdomain Enumerator - Made by PentesterHelper.in ${COLORS.reset}`);
  console.log(`${COLORS.yellow}🌐 Target Domain:${COLORS.reset} ${domain}`);
  console.log(`${COLORS.yellow}⚙️ Total Sources:${COLORS.reset} ${sources.length}\n`);

  for (let i = 0; i < sources.length; i++) {
    const sourceFunc = sources[i];
    const name = sourceFunc.name;

    process.stdout.write(`${COLORS.magenta}→ (${i + 1}/${sources.length}) Fetching from ${name}...${COLORS.reset}`);

    try {
      await sourceFunc(domain, uniqueSet);
      process.stdout.write(` ${COLORS.green}✅ Done${COLORS.reset}\n`);
    } catch (err) {
      errors.push(`❌ ${name} error: ${err.message}`);
      process.stdout.write(` ${COLORS.red}❌ Failed${COLORS.reset}\n`);
    }
  }

  const allSubs = Array.from(uniqueSet).sort();
  const fileName = `output-${domain}.txt`;

  fs.writeFileSync(fileName,
    `📁 Subdomains for: ${domain}\n\n` +
    allSubs.join('\n') +
    `\n\n🛑 Failed Modules:\n` +
    (errors.length ? errors.join('\n') : 'None')
  );

  console.log(`\n${COLORS.green}✅ Completed.${COLORS.reset}`);
  console.log(`${COLORS.yellow}🔢 Total Subdomains Found:${COLORS.reset} ${allSubs.length}`);
  console.log(`${COLORS.cyan}💾 Output saved to:${COLORS.reset} ${fileName}`);
  console.log(`${COLORS.magenta}🌐 Visit: https://pentesterhelper.in ${COLORS.reset}\n`);
}

// === Source Functions ===

async function fetchArchiveOrg(domain, set) {
  const res = await axios.get(`https://web.archive.org/cdx/search/cdx?url=*.${domain}/*&output=json&fl=original`);
  res.data.slice(1).forEach(row => {
    const sub = row[0].split('/')[2];
    if (sub.endsWith(domain)) set.add(sub.toLowerCase());
  });
}

async function fetchCertspotter(domain, set) {
  const res = await axios.get(`https://api.certspotter.com/v1/issuances?domain=${domain}&include_subdomains=true&expand=dns_names`);
  res.data.forEach(cert => cert.dns_names.forEach(d => {
    if (d.endsWith(domain)) set.add(d.toLowerCase());
  }));
}

async function fetchVirusTotal(domain, set) {
  let cursor = null;
  while (true) {
    const url = `https://www.virustotal.com/api/v3/domains/${domain}/subdomains?limit=40${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await axios.get(url, { headers: { 'x-apikey': virustotalKey } });
    const data = res.data.data || [];
    data.forEach(entry => set.add(entry.id.toLowerCase()));
    if (!res.data.meta?.next_cursor) break;
    cursor = res.data.meta.next_cursor;
  }
}

async function fetchCrtsh(domain, set, retries = 3) {
  while (retries--) {
    try {
      const res = await axios.get(`https://crt.sh/?q=%25.${domain}&output=json`);
      res.data.forEach(cert => {
        cert.name_value.split('\n').forEach(d => {
          if (d.endsWith(domain)) set.add(d.toLowerCase());
        });
      });
      return;
    } catch (err) {
      if (retries === 0) throw err;
      await new Promise(res => setTimeout(res, 2000));
    }
  }
}

async function fetchRapidDNS(domain, set) {
  const res = await axios.get(`https://rapiddns.io/subdomain/${domain}?full=1&down=1`);
  const matches = res.data.match(/\b(([\w-]+\.)+${domain})\b/g);
  if (matches) matches.forEach(d => set.add(d.toLowerCase()));
}
