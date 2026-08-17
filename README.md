# 📦 Supplier Made Easy — Sourcing Board

**Supplier Made Easy** is a modern, high-performance procurement intelligence tool built for comparing supplier pricelists, stock availability, and product specifications side-by-side. 

Whether you receive vendor quotes in `.xlsx`, `.xls`, or `.csv` format—across multi-sheet workbooks—Supplier Made Easy standardizes, matches, and highlights the best price options instantly.

![Supplier Made Easy Banner](https://img.shields.io/badge/License-MIT-teal.svg)
![React](https://img.shields.io/badge/React-18.2-blue.svg)
![Vite](https://img.shields.io/badge/Vite-5.1-purple.svg)

---

## ✨ Features

- **📊 Multi-Workbook & Sheet Support**: Drag & drop multiple Excel files simultaneously. The app detects sheet names, auto-filters cover/contact pages, and lets you choose exact product tabs to compare.
- **🎯 Smart Column Mapping**: Automatically detects header rows and maps `Product Name`, `SKU`, `Price`, and `Stock` columns using fuzzy heuristics.
- **🤖 Intelligent Product Matching**: Uses token similarity algorithms (Jaccard token matching & normalized SKU matching) to merge equivalent items across suppliers with custom merge/split controls.
- **💰 Best Price Highlights**: Color-coded badges instantly pinpoint the lowest cost supplier for every item, highlighting price gaps and savings potential.
- **📥 Excel Export**: Export combined side-by-side comparison tables back into clean Excel (`.xlsx`) workbooks.
- **🔒 100% Client-Side Privacy**: All file parsing happens entirely inside your browser using SheetJS. No supplier data ever leaves your computer or uploads to an external server.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.0.0 or higher)
- `npm` or `yarn`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Warrenchris/supplier--made-easy.git
   cd supplier--made-easy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

4. **Build for production:**
   ```bash
   npm run build
   ```

---

## 🛠️ Built With

- **[React](https://reactjs.org/)** — User Interface Library
- **[Vite](https://vitejs.dev/)** — Next-Generation Frontend Tooling
- **[SheetJS / xlsx](https://sheetjs.com/)** — Fast In-Browser Spreadsheet Processing
- **[Lucide React](https://lucide.dev/)** — Clean, Modern Icons

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
