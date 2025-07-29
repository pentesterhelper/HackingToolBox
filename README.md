# 🛠️ HackingToolsBox by Pentester Helper

A modular and powerful toolkit for bug bounty hunters and pentesters. This CLI suite provides fast and customizable tools for subdomain enumeration and Nmap scanning. Built with simplicity and performance in mind.

---

## 🚀 Getting Started

### 1. Clone the Repo

```bash
git clone https://github.com/HackingToolBox/HackingToolsBox.git
cd HackingToolsBox
```

### 2. run

```bash
node index.js
```
---


## 📦 Tools Included

### 🔍 Tool 1: Fuzzing Subdomain

Brute-forces subdomains using a custom wordlist with high concurrency and DNS resolution.

* **Description**: Performs subdomain brute-force using a wordlist.
* **Usage**:

  ```bash
  node fuzzSub example.com wordlist.txt
  ```

---

### 🌐 Tool 2: Fetching Subdomain from Source

Fetches subdomains passively from multiple public sources (e.g., VirusTotal, crt.sh, etc.).

* **Description**: Gathers subdomains from online public sources.
* **Usage**:

  ```bash
  node onSub example.com
  ```

---

### ⚡ Tool 3: Nmap Scanner

Performs concurrent Nmap scans on domains/subdomains from a wordlist, with customizable options and auto-report generation (TXT + HTML).

* **Description**: Scans domains from wordlist using custom Nmap options.
* **Usage**:

  ```bash
  node index.js -w domains.txt -nmp "-p- -T4" -o result.txt
  ```



## 🧠 Features

* High-performance subdomain enumeration
* Passive data gathering from multiple online sources
* Multi-threaded Nmap scanning with live progress
* Auto-formatted HTML reports
* Beautiful terminal UI with progress, ETA, and color-coded logs

---

## 🌍 Project Info

* **Website**: [https://pentesterhelper.in](https://pentesterhelper.in)
* **GitHub**: [https://github.com/HackingToolBox](https://github.com/HackingToolBox)
