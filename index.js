const chalk = require('chalk');

// Helper chalk styles
const title = chalk.bold.blue;
const label = chalk.cyan;
const usage = chalk.green;
const separator = chalk.gray('—'.repeat(60));

// Tool list
const tools = [
  {
    name: 'Fuzzing Subdomain',
    description: 'Performs subdomain brute-force using a wordlist',
    usage: 'node fuzzSub example.com wordlist.txt',
  },
  {
    name: 'Fetching Subdomain from Source',
    description: 'Gathers subdomains from online public sources',
    usage: 'node onSub example.com',
  },
  {
    name: 'Nmap Scanner',
    description: 'Scans domains from wordlist using custom Nmap options',
    usage: 'node nmap -w domains.txt -nmp "-p- -T4" -o result.txt',
  },
];

console.log(chalk.bold.white('\nHackingToolsBox by Pentester Helper\n'));

// Info Section
console.log(chalk.bold('Website :'), chalk.underline.blue('https://pentesterhelper.in'));
console.log(chalk.bold('GitHub  :'), chalk.underline.green('https://github.com/HackingToolBox'));

console.log(chalk.gray('\n' + '─'.repeat(60)));

// Print each tool
tools.forEach((tool, index) => {
  console.log(title(`\nTool ${index + 1}: ${tool.name}`));
  console.log(label('Description:'), tool.description);
  console.log(label('Usage     :'), usage(tool.usage));
  console.log(separator);
});
