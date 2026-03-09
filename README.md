# Accountant

A comprehensive web application for managing and analyzing financial documents with OCR and PDF processing capabilities.

## 🎯 Project Overview

Accountant is a Quebec tax-focused financial management tool built with modern web technologies. It enables users to process tax documents, extract financial information using OCR (Optical Character Recognition), and perform tax-related calculations and analysis. The application is deployed and accessible at [accountant-liart.vercel.app](https://accountant-liart.vercel.app).

## ✨ Features

- **PDF Processing**: Upload and process PDF documents seamlessly
- **OCR (Optical Character Recognition)**: Extract text from scanned documents using Tesseract.js
- **Tax Calculation**: Perform Quebec-specific tax calculations and analysis
- **Responsive UI**: Beautiful, modern interface built with React and Tailwind CSS
- **Real-time Preview**: Instant preview of document processing results
- **Fast Development**: Hot Module Replacement (HMR) for rapid development iteration

## 🛠️ Technology Stack

### Frontend
- **React** (v19.2.0) - UI library
- **Vite** (v7.3.1) - Build tool and development server
- **Tailwind CSS** (v4.2.1) - Utility-first CSS framework
- **@tailwindcss/vite** - Vite plugin for Tailwind CSS

### Document Processing
- **pdfjs-dist** (v5.5.207) - PDF parsing and rendering
- **tesseract.js** (v7.0.0) - OCR engine for text extraction from images

### Development Tools
- **ESLint** (v9.39.1) - Code linting
- **React ESLint Plugins** - React-specific linting rules

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Elhegzo/Accountant.git
   cd Accountant/quebec-tax-app
