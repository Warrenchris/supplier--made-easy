# 📦 Supplier Made Easy — Supplier Intelligence & Procurement Engine

**Supplier Made Easy** is a modern, high-performance procurement intelligence tool built for comparing supplier pricelists, stock availability, and product specifications side-by-side.

Whether you receive vendor quotes in `.xlsx`, `.xls`, or `.csv` format—across multi-sheet workbooks—Supplier Made Easy standardizes, matches, and highlights the best price options instantly.

![Supplier Made Easy Banner](https://img.shields.io/badge/License-MIT-teal.svg)
![React](https://img.shields.io/badge/React-18.2-blue.svg)
![Vite](https://img.shields.io/badge/Vite-5.1-purple.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)

---

## ✨ Features

- **📊 Multi-Workbook & Sheet Support**: Drag & drop multiple Excel files simultaneously. The app detects sheet names, auto-filters cover/contact pages, and lets you choose exact product tabs to compare.
- **🎯 Smart Column Mapping**: Automatically detects header rows and maps `Product Name`, `SKU`, `Price`, and `Stock` columns using fuzzy heuristics.
- **🤖 2-Pass AI Matching Engine**: Uses token similarity algorithms (Jaccard token matching & normalized SKU matching) to match equivalent items across suppliers with custom merge/split controls.
- **💰 Best Price Highlights**: Color-coded badges instantly pinpoint the lowest cost supplier for every item, highlighting price gaps and savings potential.
- **📥 Excel Export**: Export combined side-by-side comparison tables back into clean Excel (`.xlsx`) workbooks.
- **🐳 Dockerized Deployment**: Built with a multi-stage Dockerfile and `docker-compose` for single-command production containers.

---

## 🚀 Quick Start (Local Node)

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.0.0 or higher)
- `npm` or `yarn`

```bash
# Clone the repository
git clone https://github.com/Warrenchris/supplier--made-easy.git
cd supplier--made-easy

# Install dependencies
npm install

# Run backend API server and frontend UI concurrently
npm run dev
```
Open `http://localhost:3000` in your browser. API runs on `http://localhost:3001/api`.

---

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and launch application container
docker-compose up -d --build
```
Access the application at `http://localhost:3000`.

### Using Docker CLI

```bash
# Build Docker image
docker build -t supplier-made-easy .

# Run production container
docker run -d -p 3000:3001 --name supplier-made-easy supplier-made-easy
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
